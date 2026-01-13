import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStore } from "../../app/auth/authStore";
import { authClient } from "../authClient";

function base64UrlEncodeJson(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = globalThis.btoa(binary);
  return base64.replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncodeJson({ alg: "none", typ: "JWT" });
  const body = base64UrlEncodeJson(payload);
  // signature is ignored by frontend (we only decode payload)
  return `${header}.${body}.`;
}

function mockFetchJson(status: number, body: unknown) {
  const headers = new Map<string, string>([["content-type", "application/json"]]);
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? null,
    },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  })) as unknown as typeof fetch;
}

describe("authClient.login (unit)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("POSTs /api/v1/admin/auth/login with {email,password} and stores tokens", async () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const accessToken = makeJwt({ sub: "u1", role: "ADMIN", typ: "access", exp });

    const fetchMock = mockFetchJson(200, {
      accessToken,
      refreshToken: "refresh-1",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    globalThis.fetch = fetchMock;

    await authClient.login("admin@example.com", "ChangeMe123!");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];

    expect(url.endsWith("/api/v1/admin/auth/login")).toBe(true);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ email: "admin@example.com", password: "ChangeMe123!" }));

    const stored = authStore.get();
    expect(stored?.access_token).toBe(accessToken);
    expect(stored?.refresh_token).toBe("refresh-1");
    expect(stored?.user.system_role).toBe("ADMIN");
    expect(stored?.user.permissions).toContain("*");
    expect(stored?.user.id).toBe("u1");
  });

  it("surfaces nested backend error message", async () => {
    const fetchMock = mockFetchJson(400, {
      error: {
        code: "INTERNAL_ERROR",
        message: "body/password must NOT have fewer than 8 characters",
      },
    });

    globalThis.fetch = fetchMock;

    await expect(authClient.login("admin@example.com", "pw")).rejects.toThrow(
      "body/password must NOT have fewer than 8 characters"
    );
  });
});
