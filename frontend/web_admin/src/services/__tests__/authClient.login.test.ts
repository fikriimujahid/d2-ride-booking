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

  it("POSTs /api/v1/admin/auth/login with {email,password} and returns MFA challenge (no tokens yet)", async () => {
    const fetchMock = mockFetchJson(200, {
      challengeName: "SOFTWARE_TOKEN_MFA",
      session: "sess-1",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    globalThis.fetch = fetchMock;

    const result = await authClient.login("admin@example.com", "ChangeMe123!");
    expect(result.kind).toBe("MFA_CHALLENGE");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];

    expect(url.endsWith("/api/v1/admin/auth/login")).toBe(true);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ email: "admin@example.com", password: "ChangeMe123!" }));

    expect(authStore.get()).toBeNull();
  });

  it("stores tokens after responding to MFA challenge", async () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const accessToken = makeJwt({ sub: "u1", role: "ADMIN", typ: "access", exp });

    const fetchMock = vi
      .fn()
      // /admin/auth/login/mfa
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          accessToken,
          refreshToken: "refresh-1",
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        }),
        text: async () => "",
      })
      // /admin/auth/permissions (best-effort)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ permissions: ["admin:rbac:read"] }),
        text: async () => "",
      });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await authClient.respondToMfaChallenge({ session: "sess-1", otp: "123456", email: "admin@example.com" });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const stored = authStore.get();
    expect(stored?.access_token).toBe(accessToken);
    expect(stored?.refresh_token).toBe("refresh-1");
    expect(stored?.user.system_role).toBe("ADMIN");
    expect(stored?.user.id).toBe("u1");
    expect(stored?.user.permissions).toContain("admin:rbac:read");
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
