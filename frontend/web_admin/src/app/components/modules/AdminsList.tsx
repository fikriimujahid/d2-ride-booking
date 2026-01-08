import type { Admin } from "./AdminTypes";
import { authStore } from "../../auth/authStore";

interface AdminsListProps {
  admins: Admin[];
  onEdit: (admin: Admin) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
}

export function AdminsList({ admins, onEdit, onDelete, onToggleStatus }: AdminsListProps) {
  const canManageAdmins = authStore.hasPermission("admin.admins.manage");

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: "bg-purple-100 text-purple-800",
      support_admin: "bg-blue-100 text-blue-800",
      operations_admin: "bg-green-100 text-green-800",
      analyst: "bg-yellow-100 text-yellow-800",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Admin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Roles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Permissions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                2FA
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {admins.map((admin) => (
              <tr key={admin.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {admin.full_name?.charAt(0) || admin.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {admin.full_name || "No Name"}
                      </div>
                      <div className="text-sm text-gray-500">{admin.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {admin.roles.map((role) => (
                      <span
                        key={role}
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(role)}`}
                      >
                        {role.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {admin.permissions.length} permissions
                  </div>
                  <div className="text-xs text-gray-500">
                    {admin.permissions.slice(0, 2).join(", ")}
                    {admin.permissions.length > 2 && ` +${admin.permissions.length - 2} more`}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {admin.is_active ? (
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {admin.two_factor_enabled ? (
                    <span className="inline-flex items-center text-green-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="ml-1 text-sm">Enabled</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-red-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="ml-1 text-sm">Disabled</span>
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(admin.last_login_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(admin)}
                      disabled={!canManageAdmins}
                      className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Edit"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => onToggleStatus(admin.id)}
                      disabled={!canManageAdmins}
                      className={`${admin.is_active ? "text-orange-600 hover:text-orange-900" : "text-green-600 hover:text-green-900"} disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={admin.is_active ? "Deactivate" : "Activate"}
                    >
                      {admin.is_active ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                          />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => onDelete(admin.id)}
                      disabled={!canManageAdmins}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
