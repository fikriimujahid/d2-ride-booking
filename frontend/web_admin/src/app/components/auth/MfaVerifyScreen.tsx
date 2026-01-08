import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ApiError } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { MfaStep } from "./MfaStep";

export function MfaVerifyScreen() {
  const { pendingMfaVerify, submitTotpCode, logout } = useAuth();

  const [mfaCode, setMfaCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullCode = useMemo(() => mfaCode.join(""), [mfaCode]);

  if (!pendingMfaVerify) return null;

  const handleMfaInput = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const next = [...mfaCode];
      next[index] = value;
      setMfaCode(next);

      if (value && index < 5) {
        document.getElementById(`mfa-${index + 1}`)?.focus();
      }
    }
  };

  const handleMfaKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !mfaCode[index] && index > 0) {
      document.getElementById(`mfa-${index - 1}`)?.focus();
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
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <MfaStep
            error={error}
            mfaCode={mfaCode}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onBackToLogin={logout}
            onMfaInput={handleMfaInput}
            onMfaKeyDown={handleMfaKeyDown}
          />
        </div>
      </div>
    </div>
  );
}
