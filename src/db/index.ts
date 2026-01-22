// =============================================================================
// src/db/index.ts
// PostgreSQL Database Connection Pool
// =============================================================================

import pg from 'pg';
import { config } from '../config/index.js';
import { DatabaseError } from '../errors/index.js';

const { Pool } = pg;

// =============================================================================
// Pool Configuration
// =============================================================================

const poolConfig: pg.PoolConfig = {
  connectionString: config.databaseUrl,
  max: 20,                    // Maximum connections in pool
  min: 2,                     // Minimum connections in pool
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Connection timeout
  allowExitOnIdle: false
};

// =============================================================================
// Create Pool
// =============================================================================

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool(poolConfig);

    pool.on('connect', () => {
      console.log('✅ PostgreSQL client connected');
    });

    pool.on('error', (err) => {
      console.error('❌ PostgreSQL pool error:', err.message);
    });

    pool.on('remove', () => {
      console.log('PostgreSQL client removed from pool');
    });
  }

  return pool;
}

// =============================================================================
// Database Helper Class
// =============================================================================

export class Database {
  private pool: pg.Pool;

  constructor() {
    this.pool = getPool();
  }

  /**
   * Execute a query and return all rows
   */
  async query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<T[]> {
    try {
      const result = await this.pool.query(text, params);
      return result.rows as T[];
    } catch (error) {
      throw new DatabaseError(
        `Query failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Execute a query and return the first row or null
   */
  async queryOne<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  /**
   * Execute a query and return the first row, throw if not found
   */
  async queryOneOrFail<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
    errorMessage: string = 'Record not found'
  ): Promise<T> {
    const row = await this.queryOne<T>(text, params);
    if (!row) {
      throw new DatabaseError(errorMessage);
    }
    return row;
  }

  /**
   * Execute a query and return the count of affected rows
   */
  async execute(text: string, params?: unknown[]): Promise<number> {
    try {
      const result = await this.pool.query(text, params);
      return result.rowCount ?? 0;
    } catch (error) {
      throw new DatabaseError(
        `Execute failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Run a transaction with automatic rollback on error
   */
  async transaction<T>(
    callback: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError(
        `Transaction failed: ${(error as Error).message}`,
        error as Error
      );
    } finally {
      client.release();
    }
  }

  /**
   * Check database connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.queryOne<{ now: Date }>('SELECT NOW() as now');
      return result !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }
}

// =============================================================================
// Singleton Database Instance
// =============================================================================

let dbInstance: Database | null = null;

export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

// Convenience export
export const db = {
  get instance() {
    return getDatabase();
  },
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => 
    getDatabase().query<T>(text, params),
  queryOne: <T = Record<string, unknown>>(text: string, params?: unknown[]) => 
    getDatabase().queryOne<T>(text, params),
  queryOneOrFail: <T = Record<string, unknown>>(text: string, params?: unknown[], errorMessage?: string) => 
    getDatabase().queryOneOrFail<T>(text, params, errorMessage),
  execute: (text: string, params?: unknown[]) => 
    getDatabase().execute(text, params),
  transaction: <T>(callback: (client: pg.PoolClient) => Promise<T>) => 
    getDatabase().transaction<T>(callback),
  healthCheck: () => 
    getDatabase().healthCheck(),
  getStats: () => 
    getDatabase().getStats()
};

// =============================================================================
// Close Pool
// =============================================================================

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
    console.log('PostgreSQL pool closed gracefully');
  }
}

export default db;
