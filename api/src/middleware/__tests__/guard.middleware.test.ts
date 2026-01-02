import { describe, expect, it, vi } from "vitest";

vi.mock("../../services/cognito.service.js", () => ({
  getUserMfaSettings: vi.fn(),
}));

describe("guard middleware (unit)", () => {
  it("requireGroup rejects missing auth", async () => {
    const next = vi.fn();
    const req = { auth: undefined } as any;

    const { requireGroup } = await import("../guard.middleware.js");

    requireGroup("Admin")(req, {} as any, next);

    const err = next.mock.calls[0]?.[0];
    expect(err?.name).toBe("UnauthorizedError");
  });

  it("requireGroup rejects insufficient group", async () => {
    const next = vi.fn();
    const req = { auth: { groups: ["Passenger"] } } as any;

    const { requireGroup } = await import("../guard.middleware.js");

    requireGroup("Admin")(req, {} as any, next);

    const err = next.mock.calls[0]?.[0];
    expect(err?.name).toBe("ApiError");
    expect(err?.code).toBe("AUTH_FORBIDDEN");
  });

  it("requireAdminMfa returns MFA_REQUIRED for admins without mfa", async () => {
    const { getUserMfaSettings } = await import("../../services/cognito.service.js");
    (getUserMfaSettings as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      UserMFASettingList: ["SOFTWARE_TOKEN_MFA"],
      PreferredMfaSetting: null,
    });

    const next = vi.fn();
    const req = {
      auth: { groups: ["Admin"], amr: [], tokenUse: "access" },
      header: vi.fn((key: string) =>
        key.toLowerCase() === "authorization" ? "Bearer token" : undefined
      ),
    } as any;

    const { requireAdminMfa } = await import("../guard.middleware.js");

    requireAdminMfa(req, {} as any, next);

    // next is called asynchronously (finally handler)
    await new Promise((r) => setImmediate(r));

    const err = next.mock.calls[0]?.[0];
    expect(err?.name).toBe("ApiError");
    expect(err?.code).toBe("MFA_REQUIRED");
    expect(err?.status).toBe(403);
  });

  it("requireAdminMfa allows non-admins even without mfa", async () => {
    const next = vi.fn();
    const req = {
      auth: { groups: ["Passenger"], amr: [], tokenUse: "access" },
      header: vi.fn(() => "Bearer token"),
    } as any;

    const { requireAdminMfa } = await import("../guard.middleware.js");

    requireAdminMfa(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });
});
