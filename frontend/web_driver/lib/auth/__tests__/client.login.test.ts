import { beforeEach, describe, expect, it, vi } from "vitest";

import { driverLogin } from "../client";

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

describe("driverLogin (unit)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("POSTs /api/v1/driver/auth/login with {email,password} and stores tokens in sessionStorage", async () => {
    const fetchMock = mockFetchJson(200, {
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    globalThis.fetch = fetchMock;
    const result = await driverLogin("driver@example.com", "ChangeMe123!");
    expect(result.ok).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];

    expect(url).toBe("/api/v1/driver/auth/login");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ email: "driver@example.com", password: "ChangeMe123!" }));

    // Stored in sessionStorage (not localStorage)
    const stored = sessionStorage.getItem("d2_driver_tokens");
    expect(stored).toContain("access-1");
    expect(localStorage.getItem("d2_driver_tokens")).toBeNull();
  });

  it("returns backend validation message from nested error envelope", async () => {
    const fetchMock = mockFetchJson(400, {
      error: {
        code: "INTERNAL_ERROR",
        message: "body/password must NOT have fewer than 8 characters",
      },
    });

    globalThis.fetch = fetchMock;

    const result = await driverLogin("driver@example.com", "pw");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toBe("body/password must NOT have fewer than 8 characters");
    }
  });
});
