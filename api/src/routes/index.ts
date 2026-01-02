import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { adminRoutes } from './admin.routes.js';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/admin', adminRoutes);
