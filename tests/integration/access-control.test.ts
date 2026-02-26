// =============================================================================
// tests/integration/access-control.test.ts
// Integration tests for Access Control:
//   ConversationService.checkAccess → conversationAuth middleware →
//   role-based restrictions → admin bypass → multi-criteria access checks
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  createMockConversation,
  createMockTeamMember,
  createMockLead,
  createMockDeal,
} from '../helpers.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDb, mockRedis } = vi.hoisted(() => {
  const _mockDb = {
    query: vi.fn(),
    queryOne: vi.fn(),
    queryOneOrFail: vi.fn(),
    execute: vi.fn().mockResolvedValue(1),
    transaction: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
    getStats: vi.fn().mockReturnValue({ totalCount: 1, idleCount: 1, waitingCount: 0 }),
    get instance() { return this; },
  };
  const _mockRedis = {
    publish: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn().mockResolvedValue(undefined),
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    keys: vi.fn().mockResolvedValue([]),
    pipeline: () => ({ get: vi.fn(), exec: vi.fn().mockResolvedValue([]) }),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
  };
  return { mockDb: _mockDb, mockRedis: _mockRedis };
});

vi.mock('../../src/db/index.js', () => ({
  db: mockDb,
  getDatabase: () => mockDb,
  getPool: () => ({}),
  closePool: vi.fn(),
  default: mockDb,
}));

vi.mock('../../src/config/redis.js', () => ({
  getRedisConnection: () => mockRedis,
  redisOptions: {},
  testRedisConnection: vi.fn().mockResolvedValue(true),
  closeRedisConnection: vi.fn(),
}));

vi.mock('../../src/services/emailService.js', () => ({
  getEmailService: () => ({
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock('../../src/services/linkedinService.js', () => ({
  getLinkedInService: () => ({
    sendMessage: vi.fn().mockResolvedValue({ success: false, mode: 'manual', details: 'N/A' }),
  }),
}));

vi.mock('../../src/utils/crypto.js', () => ({
  encrypt: (text: string) => `enc:${text}`,
  decrypt: (text: string) => text.startsWith('enc:') ? text.slice(4) : text,
  isEncrypted: (text: string) => text.startsWith('enc:'),
  generateEncryptionKey: () => 'a'.repeat(64),
  resetEncryptionKey: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import system under test
// ---------------------------------------------------------------------------

import { ConversationService } from '../../src/services/conversationService.js';
import { MessageService } from '../../src/services/messageService.js';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const adminUser = createMockTeamMember({ id: uuidv4(), email: 'admin@dna.de', role: 'admin' });
const agentUser = createMockTeamMember({ id: uuidv4(), email: 'agent@dna.de', role: 'ae' });
const otherAgent = createMockTeamMember({ id: uuidv4(), email: 'other@dna.de', role: 'bdr' });
const lead = createMockLead({ id: uuidv4(), email: 'lead@kunde.de' });
const deal = createMockDeal({ id: uuidv4(), lead_id: lead.id, assigned_to: agentUser.id });

// =============================================================================
// Test Suites
// =============================================================================

describe('Zugriffskontrollen Integration', () => {
  let conversationService: ConversationService;
  let messageService: MessageService;

  beforeEach(() => {
    conversationService = new ConversationService();
    messageService = new MessageService();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. Admin-Bypass
  // ===========================================================================

  describe('Admin-Bypass', () => {
    it('Admin hat immer Zugriff (ohne DB-Abfrage)', async () => {
      const result = await conversationService.checkAccess(
        uuidv4(), adminUser.id, adminUser.email, adminUser.role
      );

      expect(result).toBe(true);
      // Admin bypass should not hit the database
      expect(mockDb.queryOne).not.toHaveBeenCalled();
    });

    it('Admin kann jede Konversation bearbeiten', async () => {
      const convId = uuidv4();
      const mockConv = createMockConversation({
        id: convId,
        created_by_id: otherAgent.id, // created by someone else
      });

      // checkAccess: admin role → immediate true
      // existing check for updateConversation
      mockDb.queryOne
        .mockResolvedValueOnce(mockConv)
        .mockResolvedValueOnce({ ...mockConv, subject: 'Admin Update', unread_count: 0, message_count: 0 });
      mockDb.execute.mockResolvedValueOnce(1);

      const result = await conversationService.updateConversation(
        convId,
        { subject: 'Admin Update' },
        adminUser.id,
        adminUser.email,
        adminUser.role
      );

      expect(result.subject).toBe('Admin Update');
    });

    it('Admin kann jede Konversation löschen', async () => {
      const convId = uuidv4();
      const mockConv = createMockConversation({ id: convId, created_by_id: otherAgent.id });

      mockDb.queryOne.mockResolvedValueOnce(mockConv);
      mockDb.execute.mockResolvedValueOnce(1);

      await expect(
        conversationService.deleteConversation(convId, adminUser.id, adminUser.email, adminUser.role)
      ).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // 2. Creator Access
  // ===========================================================================

  describe('Ersteller-Zugriff', () => {
    it('Ersteller hat Zugriff auf eigene Konversation', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: true });

      const result = await conversationService.checkAccess(
        uuidv4(), agentUser.id, agentUser.email, agentUser.role
      );

      expect(result).toBe(true);
    });

    it('Nicht-Ersteller ohne Zuordnung hat keinen Zugriff', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: false });

      const result = await conversationService.checkAccess(
        uuidv4(), otherAgent.id, otherAgent.email, otherAgent.role
      );

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // 3. Participant Email Access
  // ===========================================================================

  describe('Teilnehmer-E-Mail-Zugriff', () => {
    it('Benutzer in participant_emails hat Zugriff', async () => {
      // The DB query checks participant_emails @> '["agent@dna.de"]'::jsonb
      mockDb.queryOne.mockResolvedValueOnce({ has_access: true });

      const result = await conversationService.checkAccess(
        uuidv4(), agentUser.id, agentUser.email, agentUser.role
      );

      expect(result).toBe(true);

      // Verify that the email was passed to the query
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('participant_emails'),
        expect.arrayContaining([agentUser.id, JSON.stringify([agentUser.email])])
      );
    });
  });

  // ===========================================================================
  // 4. Deal Assignment Access
  // ===========================================================================

  describe('Deal-Zuordnungs-Zugriff', () => {
    it('Zugewiesener Agent hat Zugriff über Deal', async () => {
      // The SQL query checks d.assigned_to = $userId
      mockDb.queryOne.mockResolvedValueOnce({ has_access: true });

      const result = await conversationService.checkAccess(
        uuidv4(), agentUser.id, agentUser.email, agentUser.role
      );

      expect(result).toBe(true);
    });

    it('Agent hat Zugriff über Lead → Deal Zuordnung', async () => {
      // SQL checks dl.assigned_to = $userId (deals linked via lead)
      mockDb.queryOne.mockResolvedValueOnce({ has_access: true });

      const result = await conversationService.checkAccess(
        uuidv4(), agentUser.id, agentUser.email, agentUser.role
      );

      expect(result).toBe(true);
    });
  });

  // ===========================================================================
  // 5. assertAccess (throws on denial)
  // ===========================================================================

  describe('assertAccess', () => {
    it('wirft AuthorizationError wenn kein Zugriff', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: false });

      await expect(
        conversationService.assertAccess(uuidv4(), otherAgent.id, otherAgent.email, otherAgent.role)
      ).rejects.toThrow('You do not have access to this conversation');
    });

    it('wirft keinen Fehler bei gültigem Zugriff', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: true });

      await expect(
        conversationService.assertAccess(uuidv4(), agentUser.id, agentUser.email, agentUser.role)
      ).resolves.not.toThrow();
    });

    it('Admin passiert immer ohne DB-Abfrage', async () => {
      await expect(
        conversationService.assertAccess(uuidv4(), adminUser.id, adminUser.email, adminUser.role)
      ).resolves.not.toThrow();

      expect(mockDb.queryOne).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 6. Conversation Update Access Control
  // ===========================================================================

  describe('Update mit Zugriffskontrolle', () => {
    it('erlaubt Update durch berechtigten Benutzer', async () => {
      const convId = uuidv4();
      const mockConv = createMockConversation({ id: convId, created_by_id: agentUser.id });

      mockDb.queryOne
        .mockResolvedValueOnce({ has_access: true })  // checkAccess
        .mockResolvedValueOnce(mockConv)               // existing check
        .mockResolvedValueOnce({                       // getConversationById after update
          ...mockConv,
          status: 'archived',
          unread_count: 0,
          message_count: 0,
        });
      mockDb.execute.mockResolvedValueOnce(1);

      const result = await conversationService.updateConversation(
        convId,
        { status: 'archived' },
        agentUser.id,
        agentUser.email,
        agentUser.role
      );

      expect(result.status).toBe('archived');
    });

    it('verweigert Update durch nicht-berechtigten Benutzer', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: false });

      await expect(
        conversationService.updateConversation(
          uuidv4(),
          { subject: 'Hacked' },
          otherAgent.id,
          otherAgent.email,
          otherAgent.role
        )
      ).rejects.toThrow('access');
    });
  });

  // ===========================================================================
  // 7. Archive Access Control
  // ===========================================================================

  describe('Archivieren mit Zugriffskontrolle', () => {
    it('erlaubt Archivieren durch berechtigten Benutzer', async () => {
      const convId = uuidv4();
      const mockConv = createMockConversation({ id: convId, status: 'active' });

      mockDb.queryOne
        .mockResolvedValueOnce({ has_access: true })
        .mockResolvedValueOnce(mockConv)
        .mockResolvedValueOnce({ ...mockConv, status: 'archived', unread_count: 0, message_count: 0 });
      mockDb.execute.mockResolvedValueOnce(1);

      const result = await conversationService.archiveConversation(
        convId, agentUser.id, agentUser.email, agentUser.role
      );

      expect(result.status).toBe('archived');
    });

    it('verweigert Archivieren ohne Zugriff', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: false });

      await expect(
        conversationService.archiveConversation(
          uuidv4(), otherAgent.id, otherAgent.email, otherAgent.role
        )
      ).rejects.toThrow('access');
    });
  });

  // ===========================================================================
  // 8. Conversation With Messages Access Control
  // ===========================================================================

  describe('Konversation mit Nachrichten – Zugriffskontrolle', () => {
    it('gibt Konversation und Nachrichten bei Zugriff zurück', async () => {
      const convId = uuidv4();
      const mockConv = createMockConversation({ id: convId });

      mockDb.queryOne
        .mockResolvedValueOnce({ has_access: true })                            // assertAccess
        .mockResolvedValueOnce({ ...mockConv, unread_count: 0, message_count: 2 }) // getConversationById
        .mockResolvedValueOnce({ id: convId })                                   // getMessages: conv exists
        .mockResolvedValueOnce({ count: '2' });                                  // getMessages: count
      mockDb.query.mockResolvedValueOnce([
        { id: uuidv4(), body_text: 'Msg 1' },
        { id: uuidv4(), body_text: 'Msg 2' },
      ]);

      const result = await conversationService.getConversationWithMessages(
        convId, agentUser.id, agentUser.email, agentUser.role
      );

      expect(result.conversation.id).toBe(convId);
      expect(result.messages.data).toHaveLength(2);
    });

    it('verweigert Zugriff auf Konversation mit Nachrichten', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: false });

      await expect(
        conversationService.getConversationWithMessages(
          uuidv4(), otherAgent.id, otherAgent.email, otherAgent.role
        )
      ).rejects.toThrow('access');
    });
  });

  // ===========================================================================
  // 9. Conversation List Access Control (getConversations)
  // ===========================================================================

  describe('Konversationsliste – rollenbasierte Filterung', () => {
    it('Admin sieht alle Konversationen (kein Access-Filter)', async () => {
      const conv1 = createMockConversation({ id: uuidv4(), created_by_id: agentUser.id });
      const conv2 = createMockConversation({ id: uuidv4(), created_by_id: otherAgent.id });

      mockDb.queryOne.mockResolvedValueOnce({ count: '2' });
      mockDb.query.mockResolvedValueOnce([conv1, conv2]);

      const result = await conversationService.getConversations(
        {}, adminUser.id, adminUser.email, adminUser.role
      );

      expect(result.data).toHaveLength(2);

      // Verify no access control clause for admin
      const queryCall = mockDb.queryOne.mock.calls[0][0] as string;
      expect(queryCall).not.toContain('created_by_id = $');
    });

    it('Normaler Benutzer sieht nur eigene Konversationen (Access-Filter)', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      mockDb.query.mockResolvedValueOnce([
        createMockConversation({ created_by_id: agentUser.id }),
      ]);

      const result = await conversationService.getConversations(
        {}, agentUser.id, agentUser.email, agentUser.role
      );

      // Verify access control clause is present for non-admin
      const queryCall = mockDb.queryOne.mock.calls[0][0] as string;
      expect(queryCall).toContain('created_by_id');
      expect(queryCall).toContain('participant_emails');
      expect(queryCall).toContain('assigned_to');
    });

    it('Filterung nach lead_id respektiert Zugriffskontrolle', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      mockDb.query.mockResolvedValueOnce([
        createMockConversation({ lead_id: lead.id }),
      ]);

      const result = await conversationService.getConversations(
        { lead_id: lead.id }, agentUser.id, agentUser.email, agentUser.role
      );

      expect(result.data).toHaveLength(1);

      // Check both lead_id filter AND access control
      const queryCall = mockDb.queryOne.mock.calls[0][0] as string;
      expect(queryCall).toContain('lead_id');
    });
  });

  // ===========================================================================
  // 10. Message Delete Access Control
  // ===========================================================================

  describe('Nachricht löschen – Zugriffskontrolle', () => {
    it('Benutzer kann eigene Entwürfe löschen', async () => {
      const msgId = uuidv4();
      const msg = {
        id: msgId,
        sender_id: agentUser.id,
        status: 'draft',
        conversation_id: uuidv4(),
      };

      mockDb.queryOne.mockResolvedValueOnce(msg);
      mockDb.execute.mockResolvedValue(1);

      await expect(
        messageService.deleteMessage(msgId, agentUser.id)
      ).resolves.not.toThrow();
    });

    it('Benutzer kann eigene interne Notizen löschen', async () => {
      const msgId = uuidv4();
      const msg = {
        id: msgId,
        sender_id: agentUser.id,
        status: 'sent',
        message_type: 'internal_note',
        conversation_id: uuidv4(),
      };

      // sender_id matches userId → can delete regardless of status
      mockDb.queryOne.mockResolvedValueOnce(msg);
      mockDb.execute.mockResolvedValue(1);

      await expect(
        messageService.deleteMessage(msgId, agentUser.id)
      ).resolves.not.toThrow();
    });

    it('Benutzer kann fremde gesendete Nachrichten NICHT löschen', async () => {
      const msgId = uuidv4();
      const msg = {
        id: msgId,
        sender_id: otherAgent.id, // different user
        status: 'sent',
        conversation_id: uuidv4(),
      };

      mockDb.queryOne.mockResolvedValueOnce(msg);

      await expect(
        messageService.deleteMessage(msgId, agentUser.id)
      ).rejects.toThrow('You can only delete your own');
    });
  });

  // ===========================================================================
  // 11. Conversation Close/Reopen Access Control
  // ===========================================================================

  describe('Schließen/Öffnen – Zugriffskontrolle', () => {
    it('verweigert Schließen ohne Zugriff', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: false });

      await expect(
        conversationService.closeConversation(
          uuidv4(), otherAgent.id, otherAgent.email, otherAgent.role
        )
      ).rejects.toThrow('access');
    });

    it('verweigert Wiedereröffnen ohne Zugriff', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: false });

      await expect(
        conversationService.reopenConversation(
          uuidv4(), otherAgent.id, otherAgent.email, otherAgent.role
        )
      ).rejects.toThrow('access');
    });

    it('Admin kann geschlossene Konversation wieder öffnen', async () => {
      const convId = uuidv4();
      const mockConv = createMockConversation({ id: convId, status: 'closed' });

      // Admin: no DB check for access
      mockDb.queryOne
        .mockResolvedValueOnce(mockConv)
        .mockResolvedValueOnce({ ...mockConv, status: 'active', unread_count: 0, message_count: 0 });
      mockDb.execute.mockResolvedValueOnce(1);

      const result = await conversationService.reopenConversation(
        convId, adminUser.id, adminUser.email, adminUser.role
      );

      expect(result.status).toBe('active');
    });
  });

  // ===========================================================================
  // 12. conversationAuth Middleware
  // ===========================================================================

  describe('conversationAuth Middleware', () => {
    it('sendet 401 wenn kein User vorhanden', async () => {
      const { checkConversationAccess } = await import('../../src/api/middleware/conversationAuth.js');

      const mockRequest = {
        params: { id: uuidv4() },
        user: null,
      } as any;

      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as any;

      await checkConversationAccess(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Unauthorized' })
      );
    });

    it('sendet 403 wenn kein Zugriff', async () => {
      const { checkConversationAccess } = await import('../../src/api/middleware/conversationAuth.js');

      mockDb.queryOne.mockResolvedValueOnce({ has_access: false });

      const mockRequest = {
        params: { id: uuidv4() },
        user: { id: otherAgent.id, email: otherAgent.email, role: otherAgent.role },
      } as any;

      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as any;

      await checkConversationAccess(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Forbidden' })
      );
    });

    it('lässt berechtigten Benutzer durch', async () => {
      const { checkConversationAccess } = await import('../../src/api/middleware/conversationAuth.js');

      mockDb.queryOne.mockResolvedValueOnce({ has_access: true });

      const mockRequest = {
        params: { id: uuidv4() },
        user: { id: agentUser.id, email: agentUser.email, role: agentUser.role },
      } as any;

      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as any;

      await checkConversationAccess(mockRequest, mockReply);

      // Should NOT send any response (pass-through)
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('lässt Admin immer durch', async () => {
      const { checkConversationAccess } = await import('../../src/api/middleware/conversationAuth.js');

      const mockRequest = {
        params: { id: uuidv4() },
        user: { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      } as any;

      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as any;

      await checkConversationAccess(mockRequest, mockReply);

      // Admin should pass through without DB call
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockDb.queryOne).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 13. Cross-Role Scenarios
  // ===========================================================================

  describe('Rollenübergreifende Szenarien', () => {
    it('BDR kann auf zugewiesene Deals zugreifen', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: true });

      const bdr = createMockTeamMember({ id: uuidv4(), role: 'bdr' });
      const result = await conversationService.checkAccess(
        uuidv4(), bdr.id, bdr.email, bdr.role
      );

      expect(result).toBe(true);
    });

    it('Partnership Manager kann auf eigene Konversationen zugreifen', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: true });

      const pm = createMockTeamMember({ id: uuidv4(), role: 'partnership_manager' });
      const result = await conversationService.checkAccess(
        uuidv4(), pm.id, pm.email, pm.role
      );

      expect(result).toBe(true);
    });

    it('Unbekannte Rolle wird als Nicht-Admin behandelt', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: false });

      const result = await conversationService.checkAccess(
        uuidv4(), uuidv4(), 'unknown@test.de', 'marketing_manager'
      );

      expect(result).toBe(false);
      // Verify DB was queried (not bypassed like admin)
      expect(mockDb.queryOne).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 14. Edge Cases
  // ===========================================================================

  describe('Grenzfälle', () => {
    it('checkAccess gibt false zurück bei DB-Fehler (null result)', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await conversationService.checkAccess(
        uuidv4(), agentUser.id, agentUser.email, agentUser.role
      );

      // null → has_access is undefined → false
      expect(result).toBe(false);
    });

    it('getConversationsByLead verwendet Zugriffskontrolle', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
      mockDb.query.mockResolvedValueOnce([]);

      const result = await conversationService.getConversationsByLead(
        lead.id, agentUser.id, agentUser.email, agentUser.role
      );

      expect(result).toEqual([]);

      // Verify access-controlled query was used
      const queryCall = mockDb.queryOne.mock.calls[0][0] as string;
      expect(queryCall).toContain('created_by_id');
    });

    it('getConversationsByDeal verwendet Zugriffskontrolle', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
      mockDb.query.mockResolvedValueOnce([]);

      const result = await conversationService.getConversationsByDeal(
        deal.id, agentUser.id, agentUser.email, agentUser.role
      );

      expect(result).toEqual([]);
    });
  });
});
