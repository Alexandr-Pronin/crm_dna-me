// =============================================================================
// tests/setup.ts
// Global test setup – shared mocks for database, Redis, and external services
// =============================================================================

import { vi, beforeEach, afterEach } from 'vitest';

// Set required environment variables BEFORE any module imports
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32chars-long!!';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-16';
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
process.env.PORT = '3999';

// Reset singletons between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
