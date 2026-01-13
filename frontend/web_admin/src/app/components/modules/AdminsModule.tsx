import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminsList } from "./AdminsList";
import { AdminForm } from "./AdminForm";
import type { Admin } from "./AdminTypes";
import { authStore } from "../../auth/authStore";
import { createAdmin, deactivateAdmin, listAdmins, listRoles, updateAdmin } from "../../api/adminManagement";
import { getRecord, getString, isRecord } from "../../../shared/typeGuards";

/**
 * Admins Management Module
 * 
 * Features:
 * - List all administrators
 * - Add/edit/delete admins
 * - Manage roles and permissions
 * - View admin activity
 * - Enable/disable admin accounts
 */

export function AdminsModule() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  type RoleOption = { name: string; description?: string };
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);

  const canManageAdmins = authStore.hasPermission("admin.admins.manage");

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error && err.message) return err.message;
    if (isRecord(err)) {
      const message = getString(err.message);
      if (message) return message;

      const nested = getRecord(err.error);
      const nestedMessage = nested ? getString(nested.message) : undefined;
      if (nestedMessage) return nestedMessage;
    }
    return "Unknown error";
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [adminsRes, rolesRes] = await Promise.all([listAdmins(), listRoles()]);
      setAdmins(adminsRes);
      setRoles(rolesRes.map((r) => ({ name: r.name, description: r.description })));
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Failed to load admins");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Filter admins
  const filteredAdmins = useMemo(() => admins.filter((admin) => {
    const matchesSearch = 
      admin.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = filterRole === "all" || admin.roles.includes(filterRole);
    
    const matchesStatus = 
      filterStatus === "all" ||
      (filterStatus === "active" && admin.is_active) ||
      (filterStatus === "inactive" && !admin.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  }), [admins, filterRole, filterStatus, searchQuery]);

  const handleAddAdmin = () => {
    if (!canManageAdmins) return;
    setEditingAdmin(null);
    setShowForm(true);
  };

  const handleEditAdmin = (admin: Admin) => {
    if (!canManageAdmins) return;
    setEditingAdmin(admin);
    setShowForm(true);
  };

  const handleDeleteAdmin = async (id: string) => {
    if (!canManageAdmins) return;
    if (!confirm("Are you sure you want to deactivate this admin?")) return;
    try {
      await deactivateAdmin(id);
      await load();
    } catch (e: unknown) {
      alert(getErrorMessage(e) || "Failed to deactivate admin");
    }
  };

  const handleToggleStatus = async (id: string) => {
    if (!canManageAdmins) return;
    const target = admins.find((a) => a.id === id);
    if (!target) return;
    try {
      await updateAdmin(id, { isActive: !target.is_active });
      await load();
    } catch (e: unknown) {
      alert(getErrorMessage(e) || "Failed to update status");
    }
  };

  const handleSaveAdmin = async (payload: { email: string; password?: string; roles: string[] }) => {
    if (!canManageAdmins) return;
    try {
      if (editingAdmin) {
        await updateAdmin(editingAdmin.id, { roles: payload.roles });
      } else {
        await createAdmin({ email: payload.email, password: payload.password || "", roles: payload.roles });
      }
      setShowForm(false);
      setEditingAdmin(null);
      await load();
    } catch (e: unknown) {
      alert(getErrorMessage(e) || "Failed to save admin");
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingAdmin(null);
  };

  // Stats
  const stats = {
    total: admins.length,
    active: admins.filter((a) => a.is_active).length,
    inactive: admins.filter((a) => !a.is_active).length,
    with2fa: admins.filter((a) => a.two_factor_enabled).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Total Admins</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Active</div>
          <div className="mt-2 text-3xl font-semibold text-green-600">{stats.active}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Inactive</div>
          <div className="mt-2 text-3xl font-semibold text-red-600">{stats.inactive}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">With 2FA</div>
          <div className="mt-2 text-3xl font-semibold text-blue-600">{stats.with2fa}</div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1 flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-80"
            />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button
            onClick={handleAddAdmin}
            disabled={!canManageAdmins}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            + Add Admin
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-600">Loading admins…</div>
      )}

      {error && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-red-600">{error}</div>
          <button
            onClick={() => void load()}
            className="mt-3 px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Admin Form Modal */}
      {showForm && (
        <AdminForm
          admin={editingAdmin}
          roles={roles}
          canManage={canManageAdmins}
          onSave={handleSaveAdmin}
          onCancel={handleCancelForm}
        />
      )}

      {/* Admins List */}
      {!isLoading && !error && (
        <AdminsList
          admins={filteredAdmins}
          onEdit={handleEditAdmin}
          onDelete={handleDeleteAdmin}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {/* Empty State */}
      {filteredAdmins.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 text-lg">No admins found</div>
          <p className="text-gray-500 mt-2">Try adjusting your filters or search query</p>
        </div>
      )}
    </div>
  );
}
