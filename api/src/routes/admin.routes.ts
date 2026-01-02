import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { requireAdminMfa, requireGroup } from '../middleware/guard.middleware.js';
import { requireAdminPermission } from '../middleware/rbac.middleware.js';

export const adminRoutes = Router();

// Fail-closed by default: everything under /admin requires JWT + Admin group + MFA.
adminRoutes.use(authenticateJwt);
adminRoutes.use(requireGroup('Admin'));
adminRoutes.use(requireAdminMfa);

// Example protected endpoints (replace/extend with real handlers).
adminRoutes.get('/me', (_req, res) => {
  return res.status(200).json({ ok: true });
});

// Example child-RBAC gating (db-backed)
adminRoutes.get('/analytics', requireAdminPermission(['VIEW_ANALYTICS']), (_req, res) => {
  return res.status(200).json({ ok: true });
});

adminRoutes.get('/disputes', requireAdminPermission(['HANDLE_DISPUTES']), (_req, res) => {
  return res.status(200).json({ ok: true });
});
