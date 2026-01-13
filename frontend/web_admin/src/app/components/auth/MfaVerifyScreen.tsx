import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Shield } from "lucide-react";

export function MfaVerifyScreen() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">MFA Not Supported</h2>
            <p className="text-sm text-gray-600 mb-6">
              The current backend does not support MFA verification. Please sign in using email and password.
            </p>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="w-full bg-gray-900 text-white font-semibold py-3 px-4 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
