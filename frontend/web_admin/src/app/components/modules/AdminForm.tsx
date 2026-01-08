import { useState, useEffect } from "react";
import type { Admin } from "./AdminTypes";

interface AdminFormProps {
  admin: Admin | null;
  roles: { name: string; description?: string }[];
  canManage: boolean;
  onSave: (admin: { email: string; password?: string; roles: string[] }) => void;
  onCancel: () => void;
}

export function AdminForm({ admin, roles, canManage, onSave, onCancel }: AdminFormProps) {
  const [formData, setFormData] = useState({
    email: admin?.email || "",
    password: "",
    full_name: admin?.full_name || "",
    roles: admin?.roles || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (formData.roles.length === 0) {
      newErrors.roles = "At least one role is required";
    }

    if (!admin) {
      if (!formData.password || formData.password.length < 8) {
        newErrors.password = "Password must be at least 8 characters";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      email: formData.email,
      ...(admin ? {} : { password: formData.password }),
      roles: formData.roles
    });
  };

  const toggleRole = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
    setErrors((prev) => ({ ...prev, roles: "" }));
  };

  const roleOptions = roles.map((r) => ({
    value: r.name,
    label: r.name.replace(/_/g, " "),
    description: r.description || ""
  }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {admin ? "Edit Admin" : "Add New Admin"}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="px-6 py-4 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setErrors({ ...errors, email: "" });
                  }}
                  disabled={!!admin}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? "border-red-500" : "border-gray-300"
                  } ${admin ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  placeholder="admin@example.com"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              {!admin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temporary Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      setErrors({ ...errors, password: "" });
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.password ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="Min 8 characters"
                  />
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Roles */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Roles * (Select at least one)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {roleOptions.map((role) => (
                  <div
                    key={role.value}
                    onClick={() => canManage && toggleRole(role.value)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      formData.roles.includes(role.value)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    } ${!canManage ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked={formData.roles.includes(role.value)}
                        onChange={() => canManage && toggleRole(role.value)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        disabled={!canManage}
                      />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{role.label}</div>
                        <div className="text-xs text-gray-500">{role.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {errors.roles && <p className="mt-1 text-sm text-red-600">{errors.roles}</p>}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-900">Permissions</div>
              <p className="text-sm text-gray-600 mt-1">
                Permissions are derived from roles. Use Roles & Permissions management to change the catalog.
              </p>
            </div>

            {/* Info Box */}
            {!admin && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <svg
                    className="h-5 w-5 text-blue-400 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">New Admin Setup</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>The new admin will receive an email invitation to set up their account and enable 2FA.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canManage}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {admin ? "Update Admin" : "Create Admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
