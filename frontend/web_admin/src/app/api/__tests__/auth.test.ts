import { describe, expect, it, vi } from "vitest";

// Mock the HTTP layer so these tests stay deterministic and env-free.
vi.mock("../http", () => ({
  apiRequest: vi.fn(),
}));

describe("admin auth API (unit)", () => {
  it("adminLogin calls /admin/auth/login with email/password", async () => {
    const { apiRequest } = await import("../http");
    const { adminLogin } = await import("../auth");

    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      challengeName: "SOFTWARE_TOKEN_MFA",
      session: "sess",
      expiresAt: new Date().toISOString(),
    });

    const result = await adminLogin("admin@example.com", "pw");

    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "pw" }),
    });
    expect(result).toMatchObject({ challengeName: "SOFTWARE_TOKEN_MFA", session: "sess" });
  });

  it("adminLogin passes through 2FA-setup-required response", async () => {
    const { apiRequest } = await import("../http");
    const { adminLogin } = await import("../auth");

    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      twoFactorRequired: true,
      setupToken: "setup-token",
      expiresAt: new Date().toISOString(),
    });

    const result = await adminLogin("admin@example.com", "pw");
    expect(result).toMatchObject({ twoFactorRequired: true, setupToken: "setup-token" });
  });

  it("adminVerifyMfa calls /admin/auth/login/mfa with session + otp", async () => {
    const { apiRequest } = await import("../http");
    const { adminVerifyMfa } = await import("../auth");

    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: new Date().toISOString(),
    });

    const result = await adminVerifyMfa("sess", "123456");

    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith("/admin/auth/login/mfa", {
      method: "POST",
      body: JSON.stringify({ session: "sess", otp: "123456" }),
    });
    expect(result).toMatchObject({ accessToken: "access" });
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
