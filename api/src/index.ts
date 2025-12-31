import dotenv from 'dotenv';
dotenv.config();
import './types/express-init';

import app from './app';
// import { createServer } from 'http';
// import { initSocketServer } from './websocket';
import { logger } from './config/logger';
import { prisma } from './config/database';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // Connect to database
        await prisma.$connect();
        logger.info('Database connected successfully');

        // Start HTTP server
        const server = app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
        });

        server.on('close', () => {
            logger.info('Server connection closed');
        });

        // Graceful shutdown
        const shutdown = async () => {
            logger.info('Shutting down...');
            await prisma.$disconnect();
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
};

// Keep process alive to prevent premature exit
setInterval(() => { }, 1 << 30);

startServer();
