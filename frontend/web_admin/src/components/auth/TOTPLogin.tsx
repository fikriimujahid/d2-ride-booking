/**
 * TOTP Login Component
 * 
 * Handles login flow with mandatory TOTP 2FA for Admin users.
 * 
 * Flow:
 * 1. User enters email + password
 * 2. If TOTP not set up yet: Show error "TOTP_SETUP_REQUIRED" + button to setup
 * 3. If TOTP enabled: Show TOTP code input
 * 4. User enters 6-digit code from authenticator app
 * 5. Backend validates everything
 * 
 * B4 COMPLIANCE: Backend enforces TOTP. Frontend just handles the UI flow.
 * 
 * NOTE: This component provides the UI. Actual authentication is handled by calling functions.
 */

import React, { useState } from 'react';

interface TOTPLoginProps {
  email: string;
  onPasswordSubmit: (password: string) => Promise<void>;
  onTOTPSubmit: (totpToken: string) => Promise<void>;
  onTOTPSetupNeeded?: () => void;
  error?: string | null;
  loading?: boolean;
  requireTOTP?: boolean; // If true, show TOTP input
}

export function TOTPLogin({
  email,
  onPasswordSubmit,
  onTOTPSubmit,
  onTOTPSetupNeeded,
  error,
  loading = false,
  requireTOTP = false,
}: TOTPLoginProps) {
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onPasswordSubmit(password);
  };

  const handleTOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onTOTPSubmit(totpToken);
  };

  if (requireTOTP) {
    return (
      <form onSubmit={handleTOTPSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            disabled
            className="mt-1 block w-full px-3 py-2 border rounded-md bg-gray-100"
          />
        </div>

        <div>
          <label htmlFor="totpToken" className="block text-sm font-medium">
            Authentication Code
          </label>
          <input
            id="totpToken"
            type="text"
            value={totpToken}
            onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="Enter 6-digit code"
            required
            autoFocus
            className="mt-1 block w-full px-3 py-2 border rounded-md"
          />
          <p className="mt-1 text-sm text-gray-600">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || totpToken.length !== 6}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handlePasswordSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          disabled
          className="mt-1 block w-full px-3 py-2 border rounded-md bg-gray-100"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          className="mt-1 block w-full px-3 py-2 border rounded-md"
        />
      </div>

      {error && (
        <div className="space-y-2">
          <div className="text-red-600 text-sm">{error}</div>
          {error.includes('TOTP') && error.includes('setup') && (
            <button
              type="button"
              onClick={onTOTPSetupNeeded}
              className="text-blue-600 text-sm hover:underline"
            >
              Set up 2FA now
            </button>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
}
