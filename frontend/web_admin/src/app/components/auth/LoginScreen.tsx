import { Car } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { ApiError } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { CredentialsStep } from "./CredentialsStep.tsx";

export function LoginScreen() {
  const { loginWithPassword } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) return;

    try {
      setIsSubmitting(true);
      // AuthContext is the single "state machine" for Web Admin auth.
      // It calls the backend, stores tokens (via authStore), and sets an explicit status.
      // This screen intentionally does NOT navigate on success: routing decisions are centralized
      // in App routes / ProtectedRoute so we don't duplicate auth edge cases in UI components.
      await loginWithPassword(email, password);
      // Navigation is handled by route guards based on explicit auth state.
    } catch (e) {
      const err = e as ApiError;
      // SECURITY: keep error messages generic. We do not want to reveal whether an email exists,
      // whether password vs MFA failed, or any other detail that could help attackers.
      setError(err?.message || "Sign-in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">RideAdmin</h1>
          <p className="text-gray-600">Secure Admin Control Center</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <CredentialsStep
            error={error}
            email={email}
            password={password}
            showPassword={showPassword}
            isSubmitting={isSubmitting}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onToggleShowPassword={() => setShowPassword(!showPassword)}
            onSubmit={handleCredentialsSubmit}
          />
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            This is a secure admin portal. All activities are monitored and logged.
          </p>
        </div>
      </div>
    </div>
  );
}
