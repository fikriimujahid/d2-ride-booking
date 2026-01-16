// ========================================
// SERVER ENTRY POINT
// ========================================
// This is the main entry point for the Node.js backend process.
// It handles:
// - Application initialization (Fastify + plugins + routes)
// - Network binding (listen on host:port)
// - Process signal handling (SIGTERM, SIGINT for graceful shutdown)
// - Fatal error handling (uncaught exceptions, unhandled rejections)
//
// Execution order:
// 1. Import configuration (env variables parsed and validated)
// 2. Build Fastify app (plugins and routes registered)
// 3. Register signal handlers (graceful shutdown on SIGTERM/SIGINT)
// 4. Register global error handlers (uncaughtException, unhandledRejection)
// 5. Start listening on TCP socket
// 6. Log "server started" and enter event loop
//
// Production context:
// - Running on EC2 (DEV) or behind ALB (PROD)
// - Managed by systemd or pm2 (process supervisor)
// - SIGTERM sent by supervisor during rolling deployments
// - ALB drains connections before SIGTERM arrives

import { buildApp } from './app.js';
import { env } from './config/env.js';
import type { FastifyInstance } from 'fastify';

// Type alias for OS signals that should trigger graceful shutdown.
// SIGTERM: sent by systemd, pm2, or container orchestrators during stop/restart
// SIGINT: sent by Ctrl+C in local development
type ShutdownSignal = 'SIGINT' | 'SIGTERM';

/**
 * Main application entry point.
 * Orchestrates the full server lifecycle:
 * - Initialization
 * - Startup
 * - Runtime signal handling
 * - Graceful shutdown
 */
async function main(): Promise<void> {
  // ========================================
  // STEP 1: BUILD APPLICATION INSTANCE
  // ========================================
  // buildApp() creates a Fastify instance and:
  // - Loads environment config (already done via import)
  // - Registers all plugins (db, cors, logger, error handler, swagger)
  // - Registers all route modules (health, auth)
  // Does NOT start the server yet (no network binding).
  const app: FastifyInstance = buildApp();

  // Flag to prevent duplicate shutdown attempts.
  // If SIGTERM and SIGINT arrive at the same time, only one shutdown should execute.
  let isShuttingDown = false;
  
  // ========================================
  // STEP 2: DEFINE GRACEFUL SHUTDOWN HANDLER
  // ========================================
  /**
   * Graceful shutdown function.
   * Called when the process receives SIGTERM (production) or SIGINT (dev/Ctrl+C).
   * 
   * Lifecycle:
   * 1. Stop accepting new HTTP connections
   * 2. Wait for in-flight requests to complete (Fastify default timeout: 10s)
   * 3. Close database connection pool
   * 4. Exit process with appropriate exit code
   * 
   * Why this matters for production:
   * - ALB health checks stop routing new requests before shutdown
   * - In-flight requests are allowed to complete (avoid 502 errors)
   * - Database connections are properly released (avoid connection leaks)
   * - Exit code 0 tells systemd/pm2 this was a clean shutdown (no restart needed)
   */
  const shutdown = async (signal: ShutdownSignal) => {
    // Guard: prevent duplicate shutdown if both SIGINT and SIGTERM fire
    if (isShuttingDown) {
      app.log.warn({ signal }, 'shutdown already in progress');
      return;
    }

    // Mark shutdown in progress
    isShuttingDown = true;
    app.log.info({ signal }, 'shutting down server');

    try {
      // app.close() triggers:
      // 1. Stop listening on TCP socket (reject new connections)
      // 2. Wait for active requests to finish (with timeout)
      // 3. Call all registered 'onClose' hooks (e.g., DB pool cleanup)
      await app.close();
      
      // Structured log confirms clean shutdown
      app.log.info('server closed gracefully');
      
      // Exit code 0 = success (systemd won't restart)
      process.exitCode = 0;
    } catch (err) {
      // If app.close() fails (e.g., DB pool won't close), log and exit with error
      app.log.error({ err, signal }, 'graceful shutdown failed');
      
      // Exit code 1 = error (systemd may restart depending on policy)
      process.exitCode = 1;
    }
  };

  // ========================================
  // STEP 3: REGISTER SIGNAL HANDLERS
  // ========================================
  // SIGINT: User pressed Ctrl+C in terminal (local dev)
  // Production use case: rare, only during manual admin intervention
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // SIGTERM: Standard graceful shutdown signal (production)
  // Sent by:
  // - systemd during 'systemctl stop' or 'systemctl restart'
  // - pm2 during 'pm2 restart'
  // - Kubernetes/ECS during pod termination
  // - Auto Scaling Group during scale-down or instance refresh
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // ========================================
  // STEP 4: REGISTER GLOBAL ERROR HANDLERS
  // ========================================
  // unhandledRejection: Promise rejected but no .catch() handler
  // Common causes:
  // - Forgot 'await' on async function
  // - Database query failed but not caught
  // - External API call failed
  // 
  // Strategy: Log the error but DO NOT crash the server.
  // The error handler will also be triggered for individual request errors.
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, 'unhandled promise rejection');
  });

  // uncaughtException: Synchronous error not caught by try/catch
  // Common causes:
  // - Syntax error in a callback
  // - Null pointer dereference
  // - Out of memory
  // 
  // Strategy: Log at FATAL level and set exit code, but let the process finish cleanup.
  // Node.js will exit after the current event loop tick completes.
  // Do NOT call process.exit() here - let shutdown handlers run.
  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, 'uncaught exception');
    
    // Exit code 1 signals to systemd/pm2 that this was a crash.
    // Depending on restart policy, the service may auto-restart.
    process.exitCode = 1;
  });

  // ========================================
  // STEP 5: START SERVER (BIND TO NETWORK)
  // ========================================
  try {
    // app.listen() performs TCP socket binding.
    // This is when the server becomes reachable on the network.
    // 
    // Host '0.0.0.0': Listen on all network interfaces (required for EC2/container)
    // Port: Configured via env.PORT (default: 3001)
    // 
    // If this fails:
    // - Port already in use (another process bound to same port)
    // - Permission denied (port < 1024 requires root on Linux)
    // - Network interface not available
    await app.listen({
      host: env.host,      // e.g., '0.0.0.0'
      port: Number(env.port), // e.g., 3001
    });

    // Structured log confirms the server is now accepting connections.
    // Production monitoring systems (CloudWatch, Datadog) watch for this log.
    // ALB health checks will start succeeding after this log appears.
    app.log.info(
      { host: env.host, port: env.port },
      'server started'
    );
  } catch (err) {
    // If app.listen() fails, the server cannot start.
    // This is a FATAL error - log and exit immediately.
    app.log.fatal({ err }, 'failed to start server');
    
    // Exit code 1 signals failure.
    // systemd/pm2 will attempt restart based on policy.
    process.exit(1);
  }
}

// ========================================
// BOOTSTRAP: KICK OFF ASYNC MAIN FUNCTION
// ========================================
// 'void' operator explicitly ignores the returned Promise.
// This is intentional: errors are handled via try/catch and process event handlers.
// If main() throws, uncaughtException handler will catch it.
void main();
