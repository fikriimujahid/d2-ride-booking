import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/jwt.util.js", () => ({
  verifyCognitoJwt: vi.fn(),
}));

describe("authenticateJwt (unit)", () => {
  it("rejects when missing bearer token", async () => {
    const next = vi.fn();
    const req = {
      header: vi.fn(() => undefined),
    } as any;

    const { authenticateJwt } = await import("../auth.middleware.js");

    await authenticateJwt(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]?.[0];
    expect(err?.name).toBe("UnauthorizedError");
  });

  it("sets req.auth on success", async () => {
    const { verifyCognitoJwt } = await import("../../utils/jwt.util.js");
    (verifyCognitoJwt as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      claims: {
        sub: "sub1",
        token_use: "access",
        email: "admin@example.com",
        "cognito:groups": ["Admin"],
        amr: ["mfa"],
      },
    });

    const next = vi.fn();
    const req = {
      header: vi.fn((key: string) =>
        key.toLowerCase() === "authorization" ? "Bearer token" : undefined
      ),
    } as any;

    const { authenticateJwt } = await import("../auth.middleware.js");

    await authenticateJwt(req, {} as any, next);

    expect(req.auth).toMatchObject({
      sub: "sub1",
      tokenUse: "access",
      email: "admin@example.com",
      groups: ["Admin"],
      amr: ["mfa"],
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects tokens with invalid token_use", async () => {
    const { verifyCognitoJwt } = await import("../../utils/jwt.util.js");
    (verifyCognitoJwt as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      claims: { sub: "sub1", token_use: "refresh" },
    });

    const next = vi.fn();
    const req = {
      header: vi.fn(() => "Bearer token"),
    } as any;

    const { authenticateJwt } = await import("../auth.middleware.js");

    await authenticateJwt(req, {} as any, next);

    const err = next.mock.calls[0]?.[0];
    expect(err?.name).toBe("UnauthorizedError");
  });

  it("normalizes groups and amr safely", async () => {
    const { verifyCognitoJwt } = await import("../../utils/jwt.util.js");
    (verifyCognitoJwt as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      claims: {
        sub: "sub1",
        token_use: "id",
        "cognito:groups": ["Admin", 123, "Other"],
        amr: ["mfa", 1],
      },
    });

    const next = vi.fn();
    const req = {
      header: vi.fn(() => "Bearer token"),
    } as any;

    const { authenticateJwt } = await import("../auth.middleware.js");

    await authenticateJwt(req, {} as any, next);

    expect(req.auth.groups).toEqual(["Admin"]);
    expect(req.auth.amr).toEqual(["mfa"]);
    expect(next).toHaveBeenCalledWith();
  });
});
