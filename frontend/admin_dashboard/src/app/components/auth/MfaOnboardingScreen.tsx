import { Car, Shield } from "lucide-react";

export function MfaOnboardingScreen(props: { onStartSetup: () => void; onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">RideAdmin</h1>
          <p className="text-gray-600">Two-factor authentication onboarding</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">2FA is required</h2>
          <p className="text-sm text-gray-600 mb-6">
            Your admin account is not enrolled in multi-factor authentication yet.
          </p>

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-6">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5" />
              <div>
                <p className="font-medium">Why you’re seeing this</p>
                <p className="text-blue-700">
                  This screen is shown when the API responds with <span className="font-mono">MFA_NOT_ENROLLED</span>.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={props.onStartSetup}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Set up 2FA
          </button>

          <button
            type="button"
            onClick={props.onLogout}
            className="w-full mt-3 text-gray-600 hover:text-gray-900 py-2"
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
