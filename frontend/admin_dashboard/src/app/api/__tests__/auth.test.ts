import { describe, expect, it, vi } from "vitest";

// Mock the HTTP layer so these tests stay deterministic and env-free.
vi.mock("../http", () => ({
  apiRequest: vi.fn(),
}));

describe("admin auth API (unit)", () => {
  it("adminLogin calls /auth/admin/login with email/password", async () => {
    const { apiRequest } = await import("../http");
    const { adminLogin } = await import("../auth");

    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      access_token: "access",
      refresh_token: "refresh",
      user: {
        id: "u1",
        email: "admin@example.com",
        system_role: "ADMIN",
        roles: [],
        permissions: [],
      },
    });

    const result = await adminLogin("admin@example.com", "pw");

    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "pw" }),
    });
    expect(result).toMatchObject({ access_token: "access" });
  });

  it("adminLogin passes through MFA-required response", async () => {
    const { apiRequest } = await import("../http");
    const { adminLogin } = await import("../auth");

    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      mfa_required: true,
      email: "admin@example.com",
      session: "sess",
      challenge_name: "SOFTWARE_TOKEN_MFA",
    });

    const result = await adminLogin("admin@example.com", "pw");
    expect(result).toMatchObject({ mfa_required: true, session: "sess" });
  });

  it("adminVerifyMfa calls /auth/admin/mfa/verify with session + code", async () => {
    const { apiRequest } = await import("../http");
    const { adminVerifyMfa } = await import("../auth");

    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      access_token: "access",
      user: {
        id: "u1",
        email: "admin@example.com",
        system_role: "ADMIN",
        roles: [],
        permissions: [],
      },
    });

    const result = await adminVerifyMfa("admin@example.com", "sess", "123456");

    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith("/auth/admin/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", session: "sess", code: "123456" }),
    });
    expect(result).toMatchObject({ access_token: "access" });
  });

  it("propagates errors from the HTTP layer", async () => {
    const { apiRequest } = await import("../http");
    const { adminLogin } = await import("../auth");

    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom")
    );

    await expect(adminLogin("admin@example.com", "pw")).rejects.toThrow("boom");
  });
});
