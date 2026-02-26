// =============================================================================
// tests/helpers.ts
// Shared test helpers – factories, mock builders, and utilities
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  Conversation,
  Message,
  Lead,
  Deal,
  EmailAccount,
  TeamMember,
  MessageRecipient,
} from '../src/types/index.js';

// =============================================================================
// Factory: Team Member
// =============================================================================

export function createMockTeamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: uuidv4(),
    email: 'agent@example.com',
    name: 'Test Agent',
    role: 'ae',
    region: 'DACH',
    is_active: true,
    max_leads: 50,
    current_leads: 5,
    created_at: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Factory: Lead
// =============================================================================

export function createMockLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: uuidv4(),
    email: 'lead@customer.com',
    first_name: 'Max',
    last_name: 'Mustermann',
    status: 'qualified',
    lifecycle_stage: 'sql',
    demographic_score: 50,
    engagement_score: 30,
    behavior_score: 20,
    total_score: 100,
    routing_status: 'routed',
    intent_confidence: 0.8,
    intent_summary: { research: 0, b2b: 80, co_creation: 0 },
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Factory: Deal
// =============================================================================

export function createMockDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: uuidv4(),
    lead_id: uuidv4(),
    pipeline_id: uuidv4(),
    stage_id: uuidv4(),
    position: 1,
    name: 'Test Deal',
    value: 10000,
    currency: 'EUR',
    stage_entered_at: new Date(),
    status: 'open',
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Factory: Conversation
// =============================================================================

export function createMockConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: uuidv4(),
    lead_id: uuidv4(),
    type: 'direct',
    status: 'active',
    subject: 'Test Konversation',
    participant_emails: [],
    last_message_at: new Date(),
    created_by_id: uuidv4(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Factory: Message
// =============================================================================

export function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: uuidv4(),
    conversation_id: uuidv4(),
    sender_id: uuidv4(),
    message_type: 'email',
    direction: 'inbound',
    status: 'sent',
    sender_email: 'sender@example.com',
    sender_name: 'Test Sender',
    recipients: [{ email: 'agent@example.com', name: 'Agent', type: 'to' }],
    subject: 'Test Betreff',
    body_html: '<p>Hallo Welt</p>',
    body_text: 'Hallo Welt',
    metadata: {},
    attachments: [],
    external_id: `<test-${Date.now()}@example.com>`,
    sent_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Factory: Email Account
// =============================================================================

export function createMockEmailAccount(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return {
    id: uuidv4(),
    team_member_id: uuidv4(),
    email_address: 'agent@example.com',
    imap_host: 'imap.example.com',
    imap_port: 993,
    imap_username: 'agent@example.com',
    imap_password: 'encrypted-password',
    smtp_host: 'smtp.example.com',
    smtp_port: 587,
    smtp_username: 'agent@example.com',
    smtp_password: 'encrypted-smtp-password',
    sync_enabled: true,
    sync_status: 'idle',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Mock DB Query Builder
// =============================================================================

export interface MockQueryConfig {
  query: (sql: string, params?: unknown[]) => unknown[] | Promise<unknown[]>;
  queryOne: (sql: string, params?: unknown[]) => unknown | null | Promise<unknown | null>;
  execute: (sql: string, params?: unknown[]) => number | Promise<number>;
}

/**
 * Creates a flexible DB mock that routes queries based on SQL patterns.
 * Handlers are checked in order; the first match wins.
 */
export function createDbMock(handlers: Array<{ pattern: RegExp; result: unknown }> = []) {
  function resolve(sql: string): unknown {
    for (const { pattern, result } of handlers) {
      if (pattern.test(sql)) {
        return typeof result === 'function' ? (result as () => unknown)() : result;
      }
    }
    return null;
  }

  return {
    query: async <T>(sql: string, _params?: unknown[]): Promise<T[]> => {
      const res = resolve(sql);
      return (Array.isArray(res) ? res : res ? [res] : []) as T[];
    },
    queryOne: async <T>(sql: string, _params?: unknown[]): Promise<T | null> => {
      const res = resolve(sql);
      if (Array.isArray(res)) return (res[0] ?? null) as T | null;
      return (res ?? null) as T | null;
    },
    queryOneOrFail: async <T>(sql: string, params?: unknown[], errorMessage?: string): Promise<T> => {
      const res = resolve(sql);
      const row = Array.isArray(res) ? res[0] : res;
      if (!row) throw new Error(errorMessage ?? 'Not found');
      return row as T;
    },
    execute: async (_sql: string, _params?: unknown[]): Promise<number> => 1,
    transaction: async <T>(cb: (client: unknown) => Promise<T>): Promise<T> => {
      return cb({
        query: async () => ({ rows: [], rowCount: 0 }),
      });
    },
    healthCheck: async () => true,
    getStats: () => ({ totalCount: 1, idleCount: 1, waitingCount: 0 }),
    instance: {} as unknown,
  };
}

// =============================================================================
// Mock Redis
// =============================================================================

export function createRedisMock() {
  const store = new Map<string, string>();

  return {
    publish: async (_channel: string, _message: string) => 1,
    subscribe: async (_channel: string) => undefined,
    setex: async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return 'OK';
    },
    get: async (key: string) => store.get(key) ?? null,
    keys: async (_pattern: string) => [...store.keys()],
    pipeline: () => ({
      get: (_key: string) => undefined,
      exec: async () => [],
    }),
    on: () => undefined,
    quit: async () => undefined,
    ping: async () => 'PONG',
  };
}
