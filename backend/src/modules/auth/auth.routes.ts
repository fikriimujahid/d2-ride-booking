import type { Router } from 'express';
import { Router as createRouter } from 'express';

import { requireAuth } from './auth.middleware';

export function authRoutes(): Router {
  const router = createRouter();

  // Non-business endpoint to prove auth middleware works end-to-end.
  router.get('/whoami', requireAuth(), (req, res) => {
    res.status(200).json({ user: req.auth });
  });

  return router;
}
