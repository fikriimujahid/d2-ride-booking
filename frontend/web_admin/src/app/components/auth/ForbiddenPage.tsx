import { ShieldAlert } from "lucide-react";

export function ForbiddenPage(props: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2 text-center">Access forbidden</h1>
          <p className="text-sm text-gray-600 text-center mb-6">
            Your account is signed in, but does not have the required role to use this admin area.
          </p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 mb-6">
            This screen is shown when the API responds with the error code <span className="font-mono">RBAC_INSUFFICIENT_ROLE</span>.
          </div>

          <button
            type="button"
            onClick={props.onLogout}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
