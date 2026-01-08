import { apiRequest } from "./http";

export type AdminRow = {
  id: string;
  email: string;
  full_name?: string;
  system_role: "ADMIN";
  roles: string[];
  permissions: string[];
  is_active: boolean;
  two_factor_enabled: boolean;
  last_login_at?: string;
  created_at: string;
};

export type RoleRow = {
  name: string;
  description?: string;
  permissions: string[];
};

export type PermissionRow = {
  key: string;
  description?: string;
};

export async function listAdmins(): Promise<AdminRow[]> {
  const res = await apiRequest<{ admins: AdminRow[] }>("/admin/admins", { method: "GET", auth: true });
  return res.admins;
}

export async function listRoles(): Promise<RoleRow[]> {
  const res = await apiRequest<{ roles: RoleRow[] }>("/admin/rbac/roles", { method: "GET", auth: true });
  return res.roles;
}

export async function listPermissions(): Promise<PermissionRow[]> {
  const res = await apiRequest<{ permissions: PermissionRow[] }>("/admin/rbac/permissions", { method: "GET", auth: true });
  return res.permissions;
}

export async function createAdmin(input: { email: string; password: string; roles: string[] }): Promise<{ id: string }> {
  return apiRequest<{ id: string }>("/admin/admins", {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}

export async function updateAdmin(id: string, input: { isActive?: boolean; roles?: string[] }): Promise<void> {
  await apiRequest("/admin/admins/" + encodeURIComponent(id), {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input)
  });
}

export async function deactivateAdmin(id: string): Promise<void> {
  await apiRequest("/admin/admins/" + encodeURIComponent(id), {
    method: "DELETE",
    auth: true
  });
}
