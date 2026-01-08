import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { Shield, Copy } from "lucide-react";
import type { ApiError } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";

export function MfaSetupScreen() {
  const { pendingMfaSetup, submitTotpCode, logout } = useAuth();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qrCodeUri = pendingMfaSetup?.qrCodeUri;
  const secret = pendingMfaSetup?.secret;

  const fullCode = useMemo(() => code.join(""), [code]);

  const handleCopy = async () => {
    if (secret) {
        try {
        await navigator.clipboard.writeText(secret);
        } catch {
        // ignore
        }
    }
  };

  const onDigit = (idx: number, value: string) => {
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    const next = [...code];
    next[idx] = value;
    setCode(next);

    if (value && idx < 5) {
      document.getElementById(`mfa-setup-${idx + 1}`)?.focus();
    }
  };

  const onKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      document.getElementById(`mfa-setup-${idx - 1}`)?.focus();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(fullCode)) {
      setError("Enter the 6-digit code.");
      return;
    }

    try {
      setIsSubmitting(true);
      await submitTotpCode(fullCode);

    } catch (e) {
      const err = e as ApiError;
      setError(err?.message || "Unable to verify code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pendingMfaSetup) return null;

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
          <>
          <div className="text-center mb-8">
            <p className="text-gray-600 text-sm mb-6">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>

            <div className="bg-white p-4 border-2 border-dashed border-gray-200 rounded-xl inline-block mb-6">
              {qrCodeUri ? (
                <img src={qrCodeUri} alt="MFA QR Code" className="w-48 h-48" />
              ) : (
                <div className="w-48 h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                  Loading QR...
                </div>
              )}
            </div>

            {secret && (
                <div className="flex items-center justify-center gap-2 mb-2">
                <code className="bg-gray-100 px-3 py-1 rounded text-sm text-gray-700 font-mono">
                    {secret}
                </code>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                >
                    <Copy className="w-4 h-4" />
                </button>
                </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                Enter the 6-digit code from your app
              </label>
              <div className="flex justify-center gap-2">
                {code.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`mfa-setup-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => onDigit(idx, e.target.value)}
                    onKeyDown={(e) => onKeyDown(idx, e)}
                    className="w-10 h-12 text-center text-xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-lg text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gray-900 text-white font-semibold py-3 px-4 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? "Verifying..." : "Verify & Enable MFA"}
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Back to Sign In
            </button>
          </form>
          </>
        </div>
      </div>
    </div>
  );
}
