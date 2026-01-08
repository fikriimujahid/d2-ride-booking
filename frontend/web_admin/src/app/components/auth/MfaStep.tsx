import { Smartphone } from "lucide-react";

interface MfaStepProps {
  error: string | null;
  mfaCode: string[];
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBackToLogin: () => void;
  onMfaInput: (index: number, value: string) => void;
  onMfaKeyDown: (index: number, e: React.KeyboardEvent) => void;
}

export function MfaStep({
  error,
  mfaCode,
  isSubmitting,
  onSubmit,
  onBackToLogin,
  onMfaInput,
  onMfaKeyDown,
}: MfaStepProps) {
  return (
    <form onSubmit={onSubmit}>
      <div className="mb-6">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Smartphone className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">Two-Factor Authentication</h2>
        <p className="text-sm text-gray-600 text-center">Enter the 6-digit code from your authenticator app</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-6">
        <div className="flex gap-2 justify-center">
          {mfaCode.map((digit, index) => (
            <input
              key={index}
              id={`mfa-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => onMfaInput(index, e.target.value)}
              onKeyDown={(e) => onMfaKeyDown(index, e)}
              className="w-12 h-14 text-center text-xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        {isSubmitting ? "Signing in..." : "Verify & Sign In"}
      </button>

      <div className="mt-4 text-center">
        <button type="button" onClick={onBackToLogin} className="text-sm text-gray-600 hover:text-gray-900">
          ← Back to login
        </button>
      </div>
    </form>
  );
}
