import { useEffect, useMemo, useState } from "react";
import { Car, Shield, Copy, CheckCircle2 } from "lucide-react";
import type { ApiError } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";

type Step = "intro" | "scan" | "success";

type MfaEnrollmentFlowProps = {
  onDone: () => void;
};

function maskForDisplay(secret: string) {
  // Keep the full secret available for copy, but avoid giant UI if it's long.
  if (secret.length <= 6) return secret;
  return `${secret.slice(0, 3)}…${secret.slice(-3)}`;
}

export function MfaEnrollmentFlow(props: MfaEnrollmentFlowProps) {
  const [step, setStep] = useState<Step>("intro");
  const { logout } = useAuth();

  const forceLogoutToLogin = async () => {
    // MFA enrollment is sensitive.
    // If anything looks off (expired setup token, auth errors), we fail closed and require re-login.
    logout();
    props.onDone();
  };

  if (step === "intro") {
    return <SecureYourAccount onStart={() => setStep("scan")} />;
  }

  if (step === "scan") {
    return (
      <ScanQrCode
        onSuccess={() => setStep("success")}
        onReloginRequired={forceLogoutToLogin}
      />
    );
  }

  return <Success onLogout={forceLogoutToLogin} />;
}

function Shell(props: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">RideAdmin</h1>
          <p className="text-gray-600">{props.subtitle}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{props.title}</h2>
          {props.children}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            This is a secure admin portal. All activities are monitored and logged.
          </p>
        </div>
      </div>
    </div>
  );
}

function SecureYourAccount(props: { onStart: () => void }) {
  return (
    <Shell title="Secure Your Account" subtitle="Two-factor authentication is required">
      <p className="text-sm text-gray-600 mb-6">
        Admin accounts must enable an authenticator app (TOTP) before accessing any
        administrative features.
      </p>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-6">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 mt-0.5" />
          <div>
            <p className="font-medium">Why this is required</p>
            <p className="text-blue-700">
              It protects sensitive admin operations from account takeover.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={props.onStart}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Set up 2FA
      </button>
    </Shell>
  );
}

function ScanQrCode(props: { onSuccess: () => void; onReloginRequired: () => void }) {
  const { startTotpEnrollment, verifyTotpEnrollment } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [secret, setSecret] = useState<string>("");
  const [qrCodeUri, setQrCodeUri] = useState<string>("");
  const [qrImage, setQrImage] = useState<string>("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullCode = useMemo(() => code.join(""), [code]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Backend returns the QR code + shared secret bound to the current setup token.
        // Frontend does not generate secrets and does not decide whether enrollment is required.
        const res = await startTotpEnrollment();
        if (cancelled) return;

        setSecret(res.secretBase32);
        setQrCodeUri(res.otpauthUrl);
        setQrImage(res.qrCodeDataUrl);
      } catch (e) {
        const err = e as ApiError;
        // 401/403 here means the enrollment token/session is no longer valid.
        // We treat this as "session expired" and send user back to login.
        if (err?.code === "AUTH_UNAUTHENTICATED" || err?.code === "AUTH_FORBIDDEN" || err?.status === 401 || err?.status === 403) {
          setError("Your session expired. Please sign in again.");
        } else {
          setError(err?.message || "Failed to start 2FA setup.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
    } catch {
      // ignore
    }
  };

  const handleCodeInput = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const next = [...code];
      next[index] = value;
      setCode(next);

      if (value && index < 5) {
        const nextInput = document.getElementById(`enroll-mfa-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`enroll-mfa-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(fullCode)) {
      setError("Enter the 6-digit code.");
      return;
    }

    try {
      setIsSubmitting(true);
      await verifyTotpEnrollment(fullCode);
      props.onSuccess();
    } catch (e) {
      const err = e as ApiError;
      if (err?.code === "AUTH_UNAUTHENTICATED" || err?.code === "AUTH_FORBIDDEN" || err?.status === 401 || err?.status === 403) {
        setError("Your session expired. Please sign in again.");
        return;
      }
      setError(err?.message || "Invalid code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Shell title="Scan QR Code" subtitle="Set up your authenticator app">
      {isLoading ? (
        <p className="text-sm text-gray-600">Preparing your 2FA setup…</p>
      ) : error ? (
        <div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
            {error}
          </div>
          <button
            type="button"
            onClick={props.onReloginRequired}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Back to login
          </button>
        </div>
      ) : (
        <form onSubmit={handleVerify}>
          <p className="text-sm text-gray-600 mb-4">
            Scan the QR code with Google Authenticator, Authy, or another TOTP app.
          </p>

          <div className="flex items-center justify-center mb-4">
            {qrImage ? (
              <img
                src={qrImage}
                alt="2FA QR code"
                className="w-[220px] h-[220px] border border-gray-200 rounded-lg"
              />
            ) : (
              <div className="w-[220px] h-[220px] border border-gray-200 rounded-lg flex items-center justify-center text-sm text-gray-500">
                QR unavailable
              </div>
            )}
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-1">Manual secret</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono break-all">
                {secret}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                title="Copy secret"
                aria-label="Copy secret"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              If scanning fails, enter the secret manually.
            </p>
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-gray-900 mb-2">Enter 6-digit code</p>
            <div className="flex gap-2 justify-center">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`enroll-mfa-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeInput(index, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(index, e)}
                  className="w-12 h-14 text-center text-xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {isSubmitting ? "Verifying…" : "Verify"}
          </button>
        </form>
      )}
    </Shell>
  );
}

function Success(props: { onLogout: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => {
      props.onLogout();
    }, 900);
    return () => clearTimeout(t);
  }, [props]);

  return (
    <Shell title="Success" subtitle="2FA enabled">
      <div className="flex items-start gap-3 mb-4">
        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
        <div>
          <p className="text-sm text-gray-700">
            Two-factor authentication has been enabled for your account.
          </p>
          <p className="text-sm text-gray-600 mt-1">
            For security, you’ll be signed out and must log in again.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={props.onLogout}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Continue to login
      </button>
    </Shell>
  );
}
