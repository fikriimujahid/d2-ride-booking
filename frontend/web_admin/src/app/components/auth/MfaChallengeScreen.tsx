import { Car, Shield } from "lucide-react";
import { useMemo, useState } from "react";

import type { ApiError } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";

type Step = "challenge";

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

export function MfaChallengeScreen(props: { onCancel: () => void }) {
  const { submitMfaOtp } = useAuth();

  const [step] = useState<Step>("challenge");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullCode = useMemo(() => code.join(""), [code]);

  const handleCodeInput = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const next = [...code];
      next[index] = value;
      setCode(next);

      if (value && index < 5) {
        const nextInput = document.getElementById(`mfa-challenge-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`mfa-challenge-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(fullCode)) {
      setError("Enter the 6-digit code.");
      return;
    }

    try {
      setIsSubmitting(true);
      await submitMfaOtp(fullCode);
      // Navigation is handled by route guards based on explicit auth state.
    } catch (e) {
      const err = e as ApiError;
      setError(err?.message || "Invalid code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step !== "challenge") return null;

  return (
    <Shell title="Two-factor authentication" subtitle="Enter your 6-digit code">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-6">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 mt-0.5" />
          <div>
            <p className="font-medium">Authenticator code required</p>
            <p className="text-blue-700">Open your authenticator app and enter the 6-digit code.</p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-900 mb-2">Enter 6-digit code</p>
          <div className="flex gap-2 justify-center">
            {code.map((digit, index) => (
              <input
                key={index}
                id={`mfa-challenge-${index}`}
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

        <button
          type="button"
          onClick={props.onCancel}
          className="w-full mt-3 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Back to login
        </button>
      </form>
    </Shell>
  );
}
