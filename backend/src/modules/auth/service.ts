/**
 * Legacy Service Exports (Backward Compatibility)
 * 
 * This file maintains backward compatibility with existing code
 * that imports from ./service.js. New code should import from:
 * - auth.service.ts (business logic)
 * - auth.controller.ts (HTTP orchestration)
 * - auth.repository.ts (database access)
 */

export {
  authenticateUserWithCredentials as loginWithRole,
  exchangeMfaChallengeForTokens as adminRespondToMfaChallenge,
  createTotpSetupForAdmin as admin2faSetup,
  enableTotpForAdmin as admin2faVerify,
  listUserPermissions,
  userHasPermission,
  refreshUserSession as refreshWithRole,
  revokeUserSession as logout,
  validateLoginInput as validateRoleLoginInput
} from './auth.service.js';
