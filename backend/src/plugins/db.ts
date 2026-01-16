/**
 * DATABASE PLUGIN
 * 
 * PURPOSE:
 * - Create PostgreSQL connection pool
 * - Make database accessible to all routes via app.db
 * - Verify database connectivity before accepting traffic
 * - Gracefully close connections on shutdown
 * 
 * WHY CONNECTION POOLING:
 * - Opening new connection per request = slow (100-200ms)
 * - Connection pool = reuse connections (1-5ms)
 * - Limited connections (max 10) prevents overwhelming database
 * 
 * LIFECYCLE:
 * 1. Plugin registration: Create pool (doesn't connect yet)
 * 2. onReady hook: Verify connection works (SELECT 1)
 * 3. Server starts: Accept requests, use pool for queries
 * 4. onClose hook: Drain pool, close all connections
 * 
 * FAIL-FAST BEHAVIOR:
 * If database is unreachable:
 * → onReady throws error
 * → Server won't start
 * → systemd sees failure, won't route traffic
 * → No 500 errors from missing database
 */

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { closeDbPool, createDbPool } from '../shared/db.js';

/**
 * FASTIFY DATABASE PLUGIN
 * 
 * Registers database pool with Fastify lifecycle hooks
 * Available to routes via: app.db.query(...)
 */
export const dbPlugin: FastifyPluginAsync = fp(
  async (app) => {
    /**
     * CREATE DATABASE CONNECTION POOL
     * 
     * Creates pool instance but doesn't establish connections yet
     * Connections are lazy (created on first query)
     * 
     * Pool configuration (from createDbPool):
     * - max: 10 connections (or env.PG_POOL_MAX)
     * - idleTimeoutMillis: 30 seconds (close idle connections)
     * - connectionTimeoutMillis: 5 seconds (fail fast if DB unreachable)
     * 
     * NO DATABASE CONNECTION YET:
     * - Pool created, but no TCP connections to Postgres
     * - First connection happens in onReady hook (below)
     */
    const pool = createDbPool();

    /**
     * DECORATE FASTIFY INSTANCE
     * 
     * Makes database pool available to all routes:
     * 
     * app.get('/api/v1/users', async (request, reply) => {
     *   const result = await app.db.query('SELECT * FROM users');
     *   return result.rows;
     * });
     * 
     * TypeScript knows app.db exists (via type declaration)
     * Auto-completion works in IDE
     */
    app.decorate('db', pool);

    /**
     * ON-READY HOOK: Verify database connectivity
     * 
     * WHEN IT RUNS:
     * - After all plugins registered
     * - After all routes registered
     * - BEFORE server starts listening on port
     * - BEFORE health checks pass
     * 
     * WHY VERIFY CONNECTIVITY:
     * - Fail fast: Don't start server if database is down
     * - Prevents 500 errors on every request
     * - ALB health checks won't pass (server not listening)
     * - systemd won't mark service as ready
     * 
     * WHAT HAPPENS:
     * 1. Execute simple query (SELECT 1)
     * 2. If succeeds → database reachable, continue startup
     * 3. If fails → log fatal error, throw (server won't start)
     * 
     * PRODUCTION BENEFIT:
     * - Database down → server doesn't start → no traffic routed
     * - Database up → server starts → traffic flows normally
     * - No partial failures (server up but DB down)
     */
    app.addHook('onReady', async () => {
      try {
        /**
         * Execute connectivity test query
         * 
         * SELECT 1:
         * - Simplest possible query (no tables needed)
         * - Tests: Network, authentication, database availability
         * - Fast (< 10ms if database healthy)
         * 
         * If this succeeds:
         * Network route to database works
         * Credentials are valid
         * Database is accepting connections
         * Pool can create connections
         */
        await pool.query('SELECT 1');
        
        /**
         * Log success (helpful for deployment verification)
         * CloudWatch/Datadog: "database connection established"
         * → Confirms database is reachable
         */
        app.log.info('database connection established');
      } catch (err) {
        /**
         * Database connectivity failed
         * 
         * POSSIBLE CAUSES:
         * - Database server down
         * - Wrong credentials (PGUSER, PGPASSWORD)
         * - Network issue (firewall, security group)
         * - Database doesn't exist (PGDATABASE)
         * - Connection limit reached
         * 
         * ERROR HANDLING:
         * 1. Log fatal error (highest severity)
         *    → Alerts triggered in production monitoring
         *    → On-call engineer paged
         * 2. Throw error
         *    → Fastify sees onReady hook failed
         *    → Server doesn't start listening
         *    → app.listen() throws error
         *    → process exits with code 1
         *    → systemd sees failure, tries restart
         * 
         * DEPLOYMENT IMPACT:
         * - Rolling deployment: Old servers keep running (new ones fail)
         * - Blue/green: New environment doesn't get traffic
         * - Health checks: Fail (server not listening)
         */
        app.log.fatal({ err }, 'database connection failed');
        throw err;  // Prevent server startup
      }
    });

    /**
     * ON-CLOSE HOOK: Graceful shutdown
     * 
     * WHEN IT RUNS:
     * - Server received SIGTERM/SIGINT
     * - app.close() called (from shutdown handler)
     * - After active requests finished
     * - Before process exits
     * 
     * WHY GRACEFUL CLOSE:
     * - Close database connections cleanly
     * - Return connections to Postgres connection pool
     * - Prevent connection leaks
     * - Allow in-flight queries to complete
     * 
     * WHAT HAPPENS:
     * 1. Log shutdown message
     * 2. Call pool.end() (from closeDbPool)
     *    → Waits for active queries to finish
     *    → Closes idle connections
     *    → Returns all connections to database
     * 3. Pool is drained (no connections remain)
     * 
     * TIMING:
     * - Normal: 100-500ms (wait for queries)
     * - Slow: 5-10s (long-running queries)
     * - Timeout: 10s (Fastify forces close)
     */
    app.addHook('onClose', async () => {
      /**
       * Log shutdown (helpful for debugging graceful shutdown)
       * Shows in logs: Server is closing database connections
       */
      app.log.info('closing database pool');
      
      /**
       * Close all database connections
       * 
       * closeDbPool() calls pool.end():
       * - Stops accepting new queries
       * - Waits for active queries to complete
       * - Closes all connections to Postgres
       * - Releases resources (memory, file descriptors)
       * 
       * After this:
       * - app.db.query() will throw error
       * - But server already stopped accepting requests
       * - So no new queries will be attempted
       */
      await closeDbPool(pool);
    });
  },
  {
    // Plugin name (for debugging, logs)
    name: 'db-plugin',
  }
);
