import { describe, expect, it, vi } from "vitest";

// Mock `jose` to avoid network calls and keep tests deterministic.
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => ({ /* jwks */ })),
  jwtVerify: vi.fn(),
}));

describe("verifyCognitoJwt (unit)", () => {
  it("returns payload claims from jwtVerify", async () => {
    const jose = await import("jose");
    const { verifyCognitoJwt } = await import("../jwt.util.js");

    (jose.jwtVerify as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      payload: { sub: "sub1", token_use: "access", email: "a@b.com" },
    });

    const out = await verifyCognitoJwt("token");
    expect(out.claims).toMatchObject({ sub: "sub1", token_use: "access" });
    expect(jose.jwtVerify).toHaveBeenCalledTimes(1);
  });

  it("propagates jwtVerify errors", async () => {
    const jose = await import("jose");
    const { verifyCognitoJwt } = await import("../jwt.util.js");

    (jose.jwtVerify as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("bad"));

    await expect(verifyCognitoJwt("token")).rejects.toThrow("bad");
  });
});
