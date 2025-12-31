import { Router } from 'express';
// import rideRoutes from './ride.routes';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';

const router = Router();

// router.use('/rides', rideRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
// router.use('/drivers', driverRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/admin', adminRoutes);

export default router;
