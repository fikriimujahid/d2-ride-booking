import { Car, Shield, Lock, Mail, Eye, EyeOff, Smartphone } from "lucide-react";
import { useAdminLoginFlow } from "./useAdminLoginFlow.tsx";
import { CredentialsStep } from "./CredentialsStep.tsx";
import { MfaStep } from "./MfaStep.tsx";

interface LoginScreenProps {
  onLogin: (opts?: { mfaEnrollmentRequired?: boolean }) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const {
    step,
    setStep,
    showPassword,
    setShowPassword,
    email,
    setEmail,
    password,
    setPassword,
    mfaCode,
    isSubmitting,
    error,
    handleCredentialsSubmit,
    handleMfaSubmit,
    handleMfaInput,
    handleMfaKeyDown,
  } = useAdminLoginFlow(onLogin);

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
          {step === "credentials" ? (
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
          ) : (
            <MfaStep
              error={error}
              mfaCode={mfaCode}
              isSubmitting={isSubmitting}
              onSubmit={handleMfaSubmit}
              onBackToLogin={() => setStep("credentials")}
              onMfaInput={handleMfaInput}
              onMfaKeyDown={handleMfaKeyDown}
            />
          )}
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
