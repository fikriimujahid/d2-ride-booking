import { beforeEach, describe, expect, it } from "vitest";
import { authStore } from "../authStore";

describe("authStore (unit)", () => {
  beforeEach(() => {
    sessionStorage.clear();
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
      expires_at: new Date(Date.now() + 60_000).toISOString(),
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

  it("clears auth state", () => {
    authStore.set({
      access_token: "access",
      refresh_token: "refresh",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: "u1",
        email: "admin@example.com",
        system_role: "ADMIN",
        roles: [],
        permissions: [],
      },
    });

    authStore.clear();

    expect(authStore.get()).toBeNull();
  });

  it("rejects non-admin users for admin authorization", () => {
    authStore.set({
      access_token: "access",
      refresh_token: "refresh",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
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
    sessionStorage.setItem("rideadmin.auth", "{not-json");
    expect(authStore.get()).toBeNull();
  });
});
