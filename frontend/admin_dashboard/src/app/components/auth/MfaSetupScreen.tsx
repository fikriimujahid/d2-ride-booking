import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { Car, Shield, Copy } from "lucide-react";
import * as QRCode from "qrcode";
import type { ApiError } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";

function maskForDisplay(secret: string) {
  if (secret.length <= 6) return secret;
  return `${secret.slice(0, 3)}…${secret.slice(-3)}`;
}

export function MfaSetupScreen() {
  const { pendingMfaSetup, submitTotpCode, logout } = useAuth();

  const qrCodeUri = pendingMfaSetup?.qrCodeUri;

  const [qrImage, setQrImage] = useState<string>("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullCode = useMemo(() => code.join(""), [code]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!qrCodeUri) {
        if (!cancelled) setQrImage("");
        return;
      }

      setError(null);
      try {
        const dataUrl = await QRCode.toDataURL(qrCodeUri, {
          width: 220,
          margin: 1,
        });
        if (!cancelled) setQrImage(dataUrl);
      } catch {
        if (!cancelled) setError("Unable to render QR code. Please try again.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [qrCodeUri]);

  if (!pendingMfaSetup) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pendingMfaSetup.secret);
    } catch {
      // ignore
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">RideAdmin</h1>
          <p className="text-gray-600">Two-factor authentication setup</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Set up your authenticator</h2>

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-6">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5" />
              <div>
                <p className="font-medium">MFA is required for admin access</p>
                <p className="text-blue-700">
                  Scan the QR code, then enter the 6-digit code from your authenticator app.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="w-full">
              <p className="text-sm text-gray-600 mb-2">
                Scan this QR code in your authenticator app:
              </p>
              <div className="flex items-center justify-center mb-4">
                {qrImage ? (
                  <img
                    src={qrImage}
                    alt="MFA QR code"
                    className="w-[220px] h-[220px] border border-gray-200 rounded-lg"
                  />
                ) : (
                  <div className="w-[220px] h-[220px] border border-gray-200 rounded-lg flex items-center justify-center text-sm text-gray-500">
                    Preparing…
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  Secret: <span className="font-mono">{maskForDisplay(pendingMfaSetup.secret)}</span>
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-sm text-blue-700 hover:text-blue-800 flex items-center gap-1"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                SECURITY: keep this secret private.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="flex justify-between gap-2 mb-6">
              {code.map((digit, idx) => (
                <input
                  key={idx}
                  id={`mfa-setup-${idx}`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-12 h-12 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={digit}
                  onChange={(e) => onDigit(idx, e.target.value)}
                  onKeyDown={(e) => onKeyDown(idx, e)}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {isSubmitting ? "Verifying..." : "Verify & Continue"}
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full mt-3 text-gray-600 hover:text-gray-900 py-2"
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
