import { beforeEach, describe, expect, it } from "vitest";
import { authStore } from "../authStore";

describe("authStore (unit)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when empty", () => {
    expect(authStore.get()).toBeNull();
    expect(authStore.getAccessToken()).toBeNull();
    expect(authStore.getUser()).toBeNull();
  });

  it("sets and reads auth state", () => {
    authStore.set({
      access_token: "access",
      refresh_token: "refresh",
      user: {
        id: "u1",
        email: "admin@example.com",
        system_role: "ADMIN",
        roles: ["ops"],
        permissions: ["settings:read"],
      },
    });

    expect(authStore.getAccessToken()).toBe("access");
    expect(authStore.getRefreshToken()).toBe("refresh");
    expect(authStore.getUser()?.email).toBe("admin@example.com");
  });

  it("clears auth state and MFA enrollment flag", () => {
    authStore.set({
      access_token: "access",
      user: {
        id: "u1",
        email: "admin@example.com",
        system_role: "ADMIN",
        roles: [],
        permissions: [],
      },
    });
    authStore.setMfaEnrollmentRequired(true);

    authStore.clear();

    expect(authStore.get()).toBeNull();
    expect(authStore.isMfaEnrollmentRequired()).toBe(false);
  });

  it("tracks MFA enrollment required flag", () => {
    expect(authStore.isMfaEnrollmentRequired()).toBe(false);

    authStore.setMfaEnrollmentRequired(true);
    expect(authStore.isMfaEnrollmentRequired()).toBe(true);

    authStore.setMfaEnrollmentRequired(false);
    expect(authStore.isMfaEnrollmentRequired()).toBe(false);
  });

  it("rejects non-admin users for admin authorization", () => {
    authStore.set({
      access_token: "access",
      user: {
        id: "u1",
        email: "user@example.com",
        system_role: "PASSENGER",
        roles: [],
        permissions: [],
      },
    });

    expect(authStore.isAuthorizedForAdmin()).toBe(false);
  });

  it("handles corrupted storage safely", () => {
    // Corrupted JSON should not crash the app.
    localStorage.setItem("rideadmin.auth", "{not-json");
    expect(authStore.get()).toBeNull();
  });
});
