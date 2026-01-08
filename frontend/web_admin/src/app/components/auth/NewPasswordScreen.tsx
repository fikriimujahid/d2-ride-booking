import { Lock, Eye, EyeOff, Shield } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { ApiError } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";

export function NewPasswordScreen() {
  const { submitNewPassword, logout } = useAuth();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) return;

    if (password.length < 8) {
        setError("Password must be at least 8 characters long.");
        return;
    }

    try {
      setIsSubmitting(true);
      await submitNewPassword(password);
    } catch (e) {
      const err = e as ApiError;
      setError(err?.message || "Failed to update password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Header */}
        <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
                <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">Security Update</h1>
            <p className="text-gray-600">A new password is required for your account</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
           <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}
                
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter new password"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                      Must contain at least 8 characters, including numbers, special characters, and uppercase letters.
                  </p>
                </div>

                <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                    >
                      {isSubmitting ? "Updating..." : "Set New Password"}
                    </button>
                </div>

                <div className="text-center">
                    <button
                        type="button"
                        onClick={logout}
                        disabled={isSubmitting}
                        className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                    >
                        Back to Login
                    </button>
                </div>

              </div>
           </form>
        </div>
      </div>
    </div>
  );
}
