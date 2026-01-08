import { useState } from "react";
import { adminLogin, adminVerifyMfa } from "../../api/auth";
import { authStore } from "../../auth/authStore";
import type { AdminLoginResult, ApiError } from "../../api/types";

type Step = "credentials" | "mfa";

type LoginSuccessResult = Extract<AdminLoginResult, { access_token: string }>;
type MfaRequiredResult = Extract<AdminLoginResult, { mfa_required: true }>;

function isMfaRequiredResult(result: unknown): result is MfaRequiredResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "mfa_required" in result &&
    Boolean((result as { mfa_required?: unknown }).mfa_required) &&
    "session" in result
  );
}

function isLoginSuccessResult(result: unknown): result is LoginSuccessResult {
  return typeof result === "object" && result !== null && "access_token" in result;
}

function persistAuthSession(result: LoginSuccessResult) {
  authStore.set({
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    id_token: result.id_token,
    token_type: result.token_type,
    user: result.user,
  });
}

export function useAdminLoginFlow(onLogin: (opts?: { mfaEnrollmentRequired?: boolean }) => void) {
  const [step, setStep] = useState<Step>("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaSession, setMfaSession] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) return;

    try {
      setIsSubmitting(true);
      const result = await adminLogin(email, password);

      if (isMfaRequiredResult(result)) {
        setMfaSession(result.session);
        setStep("mfa");
        return;
      }

      if (!isLoginSuccessResult(result)) {
        setError("Login failed. Please try again.");
        return;
      }

      // Authorization: only allow users with admin system role into this dashboard.
      if (result.user.system_role !== "ADMIN") {
        setError("You are not authorized to access the admin dashboard.");
        return;
      }

      persistAuthSession(result);

      const mfaEnrollmentRequired = result.mfa_hint === "MFA_NOT_PRESENT";
      authStore.setMfaEnrollmentRequired(mfaEnrollmentRequired);
      onLogin({ mfaEnrollmentRequired });
    } catch (e) {
      const err = e as ApiError;
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!mfaCode.every((digit) => digit !== "")) return;
    if (!email || !mfaSession) {
      setStep("credentials");
      setError("Please sign in again.");
      return;
    }

    try {
      setIsSubmitting(true);
      const code = mfaCode.join("");
      const result = await adminVerifyMfa(email, mfaSession, code);

      // Authorization: only allow users with admin system role into this dashboard.
      if (result.user.system_role !== "ADMIN") {
        setError("You are not authorized to access the admin dashboard.");
        return;
      }

      persistAuthSession(result);

      authStore.setMfaEnrollmentRequired(false);
      onLogin({ mfaEnrollmentRequired: false });
    } catch (e) {
      const err = e as ApiError;
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaInput = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...mfaCode];
      newCode[index] = value;
      setMfaCode(newCode);

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`mfa-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleMfaKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !mfaCode[index] && index > 0) {
      const prevInput = document.getElementById(`mfa-${index - 1}`);
      prevInput?.focus();
    }
  };

  return {
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
  };
}
