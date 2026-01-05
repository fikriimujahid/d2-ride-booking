import { Router } from 'express';
import { login, verifyMfa, setupMfa, confirmMfa, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRbac } from '../middleware/rbac.middleware';

const router = Router();

// Public Routes
router.post('/login', login);
router.post('/mfa/verify', verifyMfa);
router.post('/mfa/setup', setupMfa);
router.post('/mfa/confirm', confirmMfa);

// Protected Routes
router.get('/me', authenticate, getMe);

// Protected Admin Route Example
router.get(
  '/admin/drivers',
  authenticate,
  requireRbac('drivers', 'read'),
  (req, res) => {
    res.json({ message: 'Access granted to driver list' });
  }
);

export default router;
