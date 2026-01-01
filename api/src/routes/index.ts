import { Router } from 'express';
// import rideRoutes from './ride.routes';
import passengerAuthRoutes from './auth/passenger.routes';
import driverAuthRoutes from './auth/driver.routes';
import adminAuthRoutes from './auth/admin.routes';
import userRoutes from './user.routes';

const router = Router();

// router.use('/rides', rideRoutes);
router.use('/auth/passenger', passengerAuthRoutes);
router.use('/auth/driver', driverAuthRoutes);
router.use('/auth/admin', adminAuthRoutes);
router.use('/users', userRoutes);
// router.use('/drivers', driverRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/admin', adminRoutes);

export default router;
