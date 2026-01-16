/**
 * DATABASE CONNECTION POOL UTILITIES
 * 
 * PURPOSE:
 * - Create PostgreSQL connection pool with optimal settings
 * - Support multiple configuration methods (DATABASE_URL or individual params)
 * - Environment-specific SSL configuration
 * - Graceful pool shutdown
 * 
 * WHY SEPARATE FILE:
 * - Reusable (can be used in scripts, tests, plugins)
 * - Testable (can mock pool creation)
 * - Clear separation: Configuration vs Registration
 * 
 * CONNECTION POOLING BENEFITS:
 * Performance: Reuse connections (1-5ms vs 100-200ms per request)
 * Resource limits: Max 10 connections (prevent overwhelming database)
 * Automatic recovery: Pool handles reconnection on connection loss
 * Idle management: Close unused connections after 30 seconds
 */

import { Pool, type PoolConfig } from 'pg';
import { env } from '../config/env.js';

/**
 * Type alias for PostgreSQL connection pool
 * 
 * Makes code more readable:
 * export function dbPlugin(pool: DbPool) ✅
 * vs
 * export function dbPlugin(pool: Pool) ❌ (less clear)
 */
export type DbPool = Pool;

/**
 * Create PostgreSQL connection pool
 * 
 * CONFIGURATION SOURCES:
 * 1. DATABASE_URL (Heroku-style, single environment variable)
 * 2. Individual params (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD)
 * 
 * POOL SETTINGS:
 * - max: 10 connections (configurable via PG_POOL_MAX)
 * - idleTimeoutMillis: 30 seconds (close idle connections)
 * - connectionTimeoutMillis: 5 seconds (fail fast if unreachable)
 * - SSL: Enabled in production (rejectUnauthorized: true)
 * 
 * @returns PostgreSQL connection pool (ready to query)
 */
export function createDbPool(): Pool {
  /**
   * BASE POOL CONFIGURATION
   * 
   * These settings apply regardless of connection method
   */
  const poolConfig: PoolConfig = {
    /**
     * max: Maximum number of connections in pool
     * 
     * Default: 10 connections
     * Override: Set PG_POOL_MAX environment variable
     * 
     * WHY 10:
     * - PostgreSQL default max_connections: 100
     * - Multiple app instances (10 instances × 10 = 100)
     * - Prevents connection exhaustion
     * - Sufficient for most workloads (each request uses connection briefly)
     * 
     * TUNING:
     * - High traffic: Increase to 20-50 (monitor database CPU)
     * - Low traffic: Decrease to 5 (save resources)
     * - Multiple services: Decrease (share database connections)
     */
    max: env.pgPoolMax ?? 10,
    
    /**
     * idleTimeoutMillis: How long idle connections stay open
     * 
     * 30 seconds (30,000ms)
     * 
     * BEHAVIOR:
     * - Connection idle for 30s → automatically closed
     * - Freed connection returned to database
     * - Next query creates new connection (if needed)
     * 
     * WHY 30 SECONDS:
     * - Traffic bursts: Connections stay warm for subsequent requests
     * - Low traffic: Idle connections cleaned up (save resources)
     * - Balance: Not too aggressive (1s), not too lazy (5min)
     * 
     * PRODUCTION IMPACT:
     * - Night hours: Low traffic, connections close
     * - Morning spike: New connections created, stay warm
     * - Lunch rush: All connections active, none close
     */
    idleTimeoutMillis: 30_000,
    
    /**
     * connectionTimeoutMillis: How long to wait for new connection
     * 
     * 5 seconds (5,000ms)
     * 
     * BEHAVIOR:
     * - Query needs connection
     * - Pool tries to connect to database
     * - If no response in 5s → throw error
     * 
     * WHY 5 SECONDS:
     * - Fast failure: Don't hang requests for 30s
     * - User experience: Return error quickly (client can retry)
     * - Database overload: Fail fast (don't queue requests)
     * 
     * FAILURE SCENARIOS:
     * - Database down → 5s timeout → 500 error
     * - Network partition → 5s timeout → 500 error
     * - Database too slow → 5s timeout → 500 error
     */
    connectionTimeoutMillis: 5_000,
  };

  /**
   * CONNECTION CONFIGURATION: DATABASE_URL vs Individual Params
   * 
   * OPTION 1: DATABASE_URL (preferred, Heroku-style)
   * - Single environment variable
   * - Format: postgresql://user:password@host:port/database
   * - Easier deployment (one variable vs five)
   * 
   * OPTION 2: Individual parameters
   * - PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
   * - More granular control
   * - Traditional PostgreSQL environment variables
   */
  if (env.databaseUrl) {
    /**
     * Use DATABASE_URL connection string
     * 
     * Example:
     * DATABASE_URL=postgresql://myuser:mypass@db.example.com:5432/mydb
     * 
     * Parsed automatically by pg library:
     * - host: db.example.com
     * - port: 5432
     * - database: mydb
     * - user: myuser
     * - password: mypass
     */
    poolConfig.connectionString = env.databaseUrl;
  } else {
    /**
     * Use individual connection parameters
     * 
     * Environment variables:
     * - PGHOST=db.example.com
     * - PGPORT=5432
     * - PGDATABASE=mydb
     * - PGUSER=myuser
     * - PGPASSWORD=mypass
     * 
     * More verbose but offers granular control
     */
    poolConfig.host = env.pgHost;
    poolConfig.port = env.pgPort;
    poolConfig.database = env.pgDatabase;
    poolConfig.user = env.pgUser;
    poolConfig.password = env.pgPassword;
  }

  /**
   * SSL CONFIGURATION (conditional)
   * 
   * WHEN ENABLED:
   * - env.pgSsl = true (or PG_SSL=true)
   * - Encrypts connection to database
   * - Required for AWS RDS, Heroku Postgres, etc.
   * 
   * CERTIFICATE VALIDATION:
   * - Production: rejectUnauthorized: true (strict, verify certificates)
   * - Development: rejectUnauthorized: false (permissive, self-signed OK)
   * 
   * WHY DIFFERENT IN DEVELOPMENT:
   * - Local databases often use self-signed certificates
   * - Strict validation fails (certificate not trusted)
   * - Development: Convenience over security
   * - Production: Security over convenience
   * 
   * SECURITY IMPLICATIONS:
   * 
   * Production (rejectUnauthorized: true):
   * - Prevents man-in-the-middle attacks
   * - Validates database certificate
   * - Only connects to trusted databases
   * 
   * Development (rejectUnauthorized: false):
   * - Accepts any certificate (even invalid)
   * - Vulnerable to MITM (acceptable for local dev)
   * - Never use in production!
   */
  if (env.pgSsl) {
    poolConfig.ssl = env.nodeEnv === 'production' 
      ? { rejectUnauthorized: true }   // Production: Strict certificate validation
      : { rejectUnauthorized: false };  // Development: Permissive (self-signed OK)
  }

  /**
   * CREATE AND RETURN POOL
   * 
   * Pool instance created but no connections established yet
   * Connections are lazy (created on first query)
   * 
   * Pool lifecycle:
   * 1. new Pool(config) → Pool created (no TCP connections)
   * 2. pool.query(...) → First connection established
   * 3. Subsequent queries → Reuse existing connections
   * 4. Idle timeout → Close unused connections
   * 5. pool.end() → Close all connections (graceful shutdown)
   */
  return new Pool(poolConfig);
}

/**
 * Close database connection pool gracefully
 * 
 * WHEN CALLED:
 * - Server shutdown (SIGTERM, SIGINT)
 * - Tests cleanup (afterAll)
 * - Process exit
 * 
 * WHAT HAPPENS:
 * 1. Stop accepting new queries
 * 2. Wait for active queries to complete (in-flight work)
 * 3. Close all idle connections
 * 4. Close all active connections (after queries finish)
 * 5. Release resources (memory, file descriptors)
 * 
 * TIMING:
 * - Normal: 100-500ms (active queries complete quickly)
 * - Slow: 5-10s (long-running queries, reports)
 * - Timeout: Fastify forces close after 10s
 * 
 * GRACEFUL vs FORCED:
 * 
 * Graceful (this function):
 * - await pool.end() → waits for queries
 * - No errors to clients
 * - No orphaned transactions
 * 
 * Forced (process.exit):
 * - pool.end() not called
 * - Connections closed immediately
 * - In-flight queries fail
 * - Clients see errors
 * 
 * @param pool - PostgreSQL connection pool to close
 */
export async function closeDbPool(pool: Pool): Promise<void> {
  /**
   * End the pool gracefully
   * 
   * Waits for:
   * - Active queries to complete
   * - Idle connections to close
   * - All resources to be released
   * 
   * After this:
   * - pool.query() will throw error
   * - All connections to database closed
   * - Pool instance is unusable (must create new pool)
   */
  await pool.end();
}