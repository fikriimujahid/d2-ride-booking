import { apiRequest } from "./http";

export async function adminMe() {
  // SECURITY: Used to validate that any stored token is still accepted by the backend.
  // Backend middleware enforces Admin group + MFA; the frontend must not treat token presence as proof.
  return apiRequest<{ ok: true }>("/admin/me", { method: "GET", auth: true });
}

export type AdminDashboardResponse = {
  totalDrivers: number;
};

export async function adminDashboard(): Promise<AdminDashboardResponse> {
  return apiRequest<AdminDashboardResponse>("/admin/dashboard", { method: "GET", auth: true });
}
