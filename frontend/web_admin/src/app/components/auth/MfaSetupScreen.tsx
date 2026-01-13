import { Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export function MfaSetupScreen() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        <div className="bg-blue-600 px-8 py-6 text-white text-center">
          <div className="mx-auto w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Secure Your Account</h2>
          <p className="text-blue-100 text-sm">Set up Two-Factor Authentication</p>
        </div>

        <div className="p-8">
          <p className="text-gray-700 text-sm mb-6">
            MFA setup is not supported by the current backend. Please sign in using email and password.
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
  );
}
