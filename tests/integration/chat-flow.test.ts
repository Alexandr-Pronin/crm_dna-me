// =============================================================================
// tests/integration/chat-flow.test.ts
// Integration tests for the complete Chat-Flow:
//   Conversation CRUD → Message creation → Status management → Real-Time events
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  createMockConversation,
  createMockMessage,
  createMockLead,
  createMockDeal,
  createMockTeamMember,
} from '../helpers.js';

// ---------------------------------------------------------------------------
// Hoisted mocks – vi.hoisted ensures these are available before vi.mock runs
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
    sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: '<sent@test>' }),
  }),
}));

vi.mock('../../src/services/linkedinService.js', () => ({
  getLinkedInService: () => ({
    sendMessage: vi.fn().mockResolvedValue({ success: false, mode: 'manual', details: 'Not configured' }),
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
// Import system under test AFTER mocks are in place
// ---------------------------------------------------------------------------

import { ConversationService } from '../../src/services/conversationService.js';
import { MessageService } from '../../src/services/messageService.js';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const teamMember = createMockTeamMember({ id: uuidv4(), email: 'agent@dna.de', role: 'ae' });
const adminMember = createMockTeamMember({ id: uuidv4(), email: 'admin@dna.de', role: 'admin' });

const lead = createMockLead({ id: uuidv4(), email: 'lead@kunde.de' });
const deal = createMockDeal({ id: uuidv4(), lead_id: lead.id, assigned_to: teamMember.id });

// =============================================================================
// Test Suites
// =============================================================================

describe('Chat-Flow Integration', () => {
  let conversationService: ConversationService;
  let messageService: MessageService;

  beforeEach(() => {
    conversationService = new ConversationService();
    messageService = new MessageService();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. Conversation CRUD
  // ===========================================================================

  describe('Konversation erstellen', () => {
    it('erstellt eine Konversation mit lead_id', async () => {
      const convId = uuidv4();
      const mockConv = createMockConversation({
        id: convId,
        lead_id: lead.id,
        created_by_id: teamMember.id,
        subject: 'Anfrage zu Produkt',
      });

      // Lead existiert
      mockDb.queryOne
        .mockResolvedValueOnce({ id: lead.id }) // lead check
        .mockResolvedValueOnce(mockConv)          // INSERT RETURNING
        .mockResolvedValueOnce({                  // getConversationById (detail query)
          ...mockConv,
          lead_email: lead.email,
          lead_name: `${lead.first_name} ${lead.last_name}`,
          unread_count: 0,
          message_count: 0,
        });

      const result = await conversationService.createConversation(
        { lead_id: lead.id, subject: 'Anfrage zu Produkt' },
        teamMember.id
      );

      expect(result.id).toBe(convId);
      expect(result.lead_email).toBe(lead.email);
      expect(mockDb.queryOne).toHaveBeenCalledTimes(3);
    });

    it('erstellt eine Konversation mit deal_id und leitet lead_id ab', async () => {
      const convId = uuidv4();

      // Deal existiert und enthält lead_id
      mockDb.queryOne
        .mockResolvedValueOnce({ id: deal.id, lead_id: lead.id }) // deal check
        .mockResolvedValueOnce({ id: lead.id })                    // lead check
        .mockResolvedValueOnce(createMockConversation({ id: convId, deal_id: deal.id, lead_id: lead.id })) // INSERT
        .mockResolvedValueOnce({                                   // getConversationById
          ...createMockConversation({ id: convId, deal_id: deal.id, lead_id: lead.id }),
          deal_name: deal.name,
          lead_email: lead.email,
        });

      const result = await conversationService.createConversation(
        { deal_id: deal.id },
        teamMember.id
      );

      expect(result.id).toBe(convId);
    });

    it('wirft ValidationError wenn weder lead_id noch deal_id angegeben', async () => {
      await expect(
        conversationService.createConversation({}, teamMember.id)
      ).rejects.toThrow('Either lead_id or deal_id must be provided');
    });

    it('wirft NotFoundError wenn Lead nicht existiert', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null); // lead check returns null

      await expect(
        conversationService.createConversation({ lead_id: uuidv4() }, teamMember.id)
      ).rejects.toThrow('not found');
    });
  });

  // ===========================================================================
  // 2. Conversation Update / Archive / Status
  // ===========================================================================

  describe('Konversation aktualisieren', () => {
    it('aktualisiert den Betreff einer Konversation', async () => {
      const convId = uuidv4();
      const mockConv = createMockConversation({ id: convId, created_by_id: teamMember.id });

      // checkAccess
      mockDb.queryOne
        .mockResolvedValueOnce({ has_access: true })   // checkAccess
        .mockResolvedValueOnce(mockConv)                // existing check
        .mockResolvedValueOnce({                        // getConversationById after update
          ...mockConv,
          subject: 'Neuer Betreff',
          unread_count: 0,
          message_count: 0,
        });
      mockDb.execute.mockResolvedValueOnce(1);

      const result = await conversationService.updateConversation(
        convId,
        { subject: 'Neuer Betreff' },
        teamMember.id,
        teamMember.email,
        teamMember.role
      );

      expect(result.subject).toBe('Neuer Betreff');
    });

    it('archiviert eine Konversation', async () => {
      const convId = uuidv4();
      const mockConv = createMockConversation({ id: convId, status: 'active', created_by_id: teamMember.id });

      mockDb.queryOne
        .mockResolvedValueOnce({ has_access: true })  // checkAccess
        .mockResolvedValueOnce(mockConv)               // existing check
        .mockResolvedValueOnce({                       // getConversationById after archive
          ...mockConv,
          status: 'archived',
          unread_count: 0,
          message_count: 0,
        });
      mockDb.execute.mockResolvedValueOnce(1);

      const result = await conversationService.archiveConversation(
        convId,
        teamMember.id,
        teamMember.email,
        teamMember.role
      );

      expect(result.status).toBe('archived');
    });

    it('verhindert erneutes Archivieren', async () => {
      const convId = uuidv4();
      const mockConv = createMockConversation({ id: convId, status: 'archived' });

      mockDb.queryOne
        .mockResolvedValueOnce({ has_access: true })
        .mockResolvedValueOnce(mockConv);

      await expect(
        conversationService.archiveConversation(convId, teamMember.id, teamMember.email, teamMember.role)
      ).rejects.toThrow('already archived');
    });

    it('schließt und öffnet eine Konversation wieder', async () => {
      const convId = uuidv4();
      const mockConvActive = createMockConversation({ id: convId, status: 'active' });
      const mockConvClosed = { ...mockConvActive, status: 'closed' as const };

      // Close
      mockDb.queryOne
        .mockResolvedValueOnce({ has_access: true })
        .mockResolvedValueOnce(mockConvActive)
        .mockResolvedValueOnce({ ...mockConvClosed, unread_count: 0, message_count: 0 });
      mockDb.execute.mockResolvedValueOnce(1);

      const closed = await conversationService.closeConversation(
        convId, teamMember.id, teamMember.email, teamMember.role
      );
      expect(closed.status).toBe('closed');

      // Reopen
      mockDb.queryOne
        .mockResolvedValueOnce({ has_access: true })
        .mockResolvedValueOnce(mockConvClosed)
        .mockResolvedValueOnce({ ...mockConvActive, unread_count: 0, message_count: 0 });
      mockDb.execute.mockResolvedValueOnce(1);

      const reopened = await conversationService.reopenConversation(
        convId, teamMember.id, teamMember.email, teamMember.role
      );
      expect(reopened.status).toBe('active');
    });
  });

  // ===========================================================================
  // 3. Message Creation (internal note)
  // ===========================================================================

  describe('Nachricht erstellen', () => {
    it('erstellt eine interne Notiz', async () => {
      const convId = uuidv4();
      const msgId = uuidv4();
      const mockConv = createMockConversation({ id: convId });
      const mockMsg = createMockMessage({
        id: msgId,
        conversation_id: convId,
        message_type: 'internal_note',
        direction: 'internal',
        status: 'sent',
        body_text: 'Interne Notiz zu diesem Lead',
      });

      // createMessage flow
      mockDb.queryOne
        .mockResolvedValueOnce(mockConv)   // conversation exists check
        .mockResolvedValueOnce(mockMsg);   // INSERT RETURNING
      mockDb.execute.mockResolvedValue(1); // updateConversationLastMessage

      const result = await messageService.createMessage(convId, {
        message_type: 'internal_note',
        body_text: 'Interne Notiz zu diesem Lead',
      }, teamMember.id);

      expect(result.id).toBe(msgId);
      expect(result.message_type).toBe('internal_note');
      expect(result.direction).toBe('internal');
      expect(result.status).toBe('sent');
    });

    it('erstellt eine ausgehende E-Mail mit Status-Management', async () => {
      const convId = uuidv4();
      const msgId = uuidv4();
      const mockConv = createMockConversation({ id: convId });

      // Draft message
      const draftMsg = createMockMessage({
        id: msgId,
        conversation_id: convId,
        message_type: 'email',
        direction: 'outbound',
        status: 'draft',
        recipients: [{ email: 'lead@kunde.de', name: 'Lead', type: 'to' }],
        body_html: '<p>Hallo</p>',
      });

      // After status changes
      const sendingMsg = { ...draftMsg, status: 'sending' as const };
      const sentMsg = { ...draftMsg, status: 'sent' as const, sent_at: new Date() };

      mockDb.queryOne
        .mockResolvedValueOnce(mockConv)    // conversation exists
        .mockResolvedValueOnce(draftMsg)    // INSERT message
        .mockResolvedValueOnce(sendingMsg)  // updateMessageStatus → sending
        .mockResolvedValueOnce(null)        // sendViaUserAccount: no user email account
        .mockResolvedValueOnce(sentMsg);    // updateMessageStatus → sent
      mockDb.execute.mockResolvedValue(1);

      const result = await messageService.createMessage(convId, {
        message_type: 'email',
        recipients: [{ email: 'lead@kunde.de', name: 'Lead', type: 'to' }],
        body_html: '<p>Hallo</p>',
        subject: 'Angebot',
      }, teamMember.id);

      expect(result.id).toBe(msgId);
    });

    it('wirft Fehler wenn Konversation nicht existiert', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null); // conversation not found

      await expect(
        messageService.createMessage(uuidv4(), {
          message_type: 'internal_note',
          body_text: 'Test',
        })
      ).rejects.toThrow('not found');
    });
  });

  // ===========================================================================
  // 4. Get Messages (Pagination)
  // ===========================================================================

  describe('Nachrichten abrufen', () => {
    it('ruft paginierte Nachrichten ab', async () => {
      const convId = uuidv4();
      const messages = [
        createMockMessage({ conversation_id: convId, body_text: 'Nachricht 1' }),
        createMockMessage({ conversation_id: convId, body_text: 'Nachricht 2' }),
        createMockMessage({ conversation_id: convId, body_text: 'Nachricht 3' }),
      ];

      mockDb.queryOne
        .mockResolvedValueOnce({ id: convId })   // conversation exists
        .mockResolvedValueOnce({ count: '3' });   // count query
      mockDb.query.mockResolvedValueOnce(messages);

      const result = await messageService.getMessages(convId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.has_next).toBe(false);
    });

    it('unterstützt Pagination mit page > 1', async () => {
      const convId = uuidv4();

      mockDb.queryOne
        .mockResolvedValueOnce({ id: convId })
        .mockResolvedValueOnce({ count: '25' });
      mockDb.query.mockResolvedValueOnce([
        createMockMessage({ conversation_id: convId }),
      ]);

      const result = await messageService.getMessages(convId, { page: 2, limit: 10 });

      expect(result.pagination.total).toBe(25);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.has_next).toBe(true);
      expect(result.pagination.has_prev).toBe(true);
      expect(result.pagination.total_pages).toBe(3);
    });

    it('wirft Fehler wenn Konversation nicht existiert', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(
        messageService.getMessages(uuidv4())
      ).rejects.toThrow('not found');
    });
  });

  // ===========================================================================
  // 5. Mark As Read
  // ===========================================================================

  describe('Nachricht als gelesen markieren', () => {
    it('markiert eine Nachricht als gelesen', async () => {
      const msgId = uuidv4();
      const msg = createMockMessage({ id: msgId, read_at: undefined });
      const readMsg = { ...msg, read_at: new Date() };

      mockDb.queryOne
        .mockResolvedValueOnce(msg)       // getMessageById
        .mockResolvedValueOnce(readMsg);  // UPDATE RETURNING

      const result = await messageService.markAsRead(msgId, teamMember.id);

      expect(result.read_at).toBeDefined();
    });

    it('gibt bestehende Nachricht zurück wenn schon gelesen', async () => {
      const msgId = uuidv4();
      const msg = createMockMessage({ id: msgId, read_at: new Date() });

      mockDb.queryOne.mockResolvedValueOnce(msg);

      const result = await messageService.markAsRead(msgId, teamMember.id);

      expect(result.read_at).toBeDefined();
      // Should not attempt to UPDATE
      expect(mockDb.queryOne).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // 6. Mark Conversation As Read
  // ===========================================================================

  describe('Konversation als gelesen markieren', () => {
    it('markiert alle inbound-Nachrichten als gelesen', async () => {
      mockDb.execute.mockResolvedValueOnce(5); // 5 messages updated

      const count = await messageService.markConversationAsRead(uuidv4(), teamMember.id);

      expect(count).toBe(5);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // 7. Message Status Update
  // ===========================================================================

  describe('Nachrichtenstatus aktualisieren', () => {
    it('aktualisiert Status von draft auf sent', async () => {
      const msgId = uuidv4();
      const sentMsg = createMockMessage({ id: msgId, status: 'sent', sent_at: new Date() });

      mockDb.queryOne.mockResolvedValueOnce(sentMsg); // UPDATE RETURNING

      const result = await messageService.updateMessageStatus(msgId, 'sent');

      expect(result.status).toBe('sent');
    });

    it('setzt error_message bei Status error', async () => {
      const msgId = uuidv4();
      const errorMsg = createMockMessage({
        id: msgId,
        status: 'error',
        error_message: 'SMTP timeout',
      });

      mockDb.queryOne.mockResolvedValueOnce(errorMsg);

      const result = await messageService.updateMessageStatus(msgId, 'error', 'SMTP timeout');

      expect(result.status).toBe('error');
      expect(result.error_message).toBe('SMTP timeout');
    });
  });

  // ===========================================================================
  // 8. Retry Failed Message
  // ===========================================================================

  describe('Fehlgeschlagene Nachricht erneut senden', () => {
    it('wiederholt nur Nachrichten mit Status error', async () => {
      const msgId = uuidv4();
      const convId = uuidv4();
      const errorMsg = createMockMessage({
        id: msgId,
        conversation_id: convId,
        status: 'error',
        message_type: 'email',
        recipients: [{ email: 'lead@kunde.de', name: 'Lead', type: 'to' }],
      });

      mockDb.queryOne
        .mockResolvedValueOnce(errorMsg)                                               // getMessageById
        .mockResolvedValueOnce(createMockConversation({ id: convId }))                 // conversation check
        .mockResolvedValueOnce({ ...errorMsg, status: 'sending' })                     // updateMessageStatus → sending
        .mockResolvedValueOnce({ ...errorMsg, status: 'sending' })                     // sendEmailForMessage → updateMessageStatus(sending)
        .mockResolvedValueOnce(null)                                                   // no user email account
        .mockResolvedValueOnce({ ...errorMsg, status: 'sent', sent_at: new Date() })   // updateMessageStatus → sent
        .mockResolvedValueOnce({ ...errorMsg, status: 'sent', sent_at: new Date() });  // final getMessageById
      mockDb.execute.mockResolvedValue(1);

      const result = await messageService.retryMessage(msgId, teamMember.id);
      expect(result.status).toBe('sent');
    });

    it('wirft Fehler wenn Status nicht error ist', async () => {
      const msgId = uuidv4();
      const sentMsg = createMockMessage({ id: msgId, status: 'sent' });

      mockDb.queryOne.mockResolvedValueOnce(sentMsg);

      await expect(
        messageService.retryMessage(msgId, teamMember.id)
      ).rejects.toThrow('Only messages with status "error"');
    });
  });

  // ===========================================================================
  // 9. Unread Counts
  // ===========================================================================

  describe('Ungelesene Nachrichten zählen', () => {
    it('zählt ungelesene Nachrichten für eine Konversation', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '7' });

      const count = await messageService.getUnreadCount(uuidv4());

      expect(count).toBe(7);
    });

    it('gibt Batch-Counts für mehrere Konversationen zurück', async () => {
      const ids = [uuidv4(), uuidv4(), uuidv4()];

      mockDb.query.mockResolvedValueOnce([
        { conversation_id: ids[0], count: '3' },
        { conversation_id: ids[2], count: '1' },
      ]);

      const counts = await messageService.getUnreadCounts(ids);

      expect(counts[ids[0]]).toBe(3);
      expect(counts[ids[1]]).toBe(0); // no unread
      expect(counts[ids[2]]).toBe(1);
    });

    it('gibt leeres Objekt für leeres Array zurück', async () => {
      const counts = await messageService.getUnreadCounts([]);
      expect(counts).toEqual({});
    });
  });

  // ===========================================================================
  // 10. Full Chat-Flow: Create Conversation → Send Message → Read
  // ===========================================================================

  describe('Vollständiger Chat-Flow', () => {
    it('Konversation erstellen → Nachricht senden → als gelesen markieren', async () => {
      const convId = uuidv4();
      const msgId = uuidv4();

      const mockConv = createMockConversation({
        id: convId,
        lead_id: lead.id,
        created_by_id: teamMember.id,
      });

      const mockMsg = createMockMessage({
        id: msgId,
        conversation_id: convId,
        message_type: 'internal_note',
        direction: 'internal',
        status: 'sent',
      });

      // Step 1: Create conversation
      mockDb.queryOne
        .mockResolvedValueOnce({ id: lead.id })  // lead exists
        .mockResolvedValueOnce(mockConv)           // INSERT conversation
        .mockResolvedValueOnce({                   // getConversationById
          ...mockConv,
          lead_email: lead.email,
          unread_count: 0,
          message_count: 0,
        });

      const conv = await conversationService.createConversation(
        { lead_id: lead.id, subject: 'Kontaktanfrage' },
        teamMember.id
      );
      expect(conv.id).toBe(convId);

      // Step 2: Create message
      mockDb.queryOne
        .mockResolvedValueOnce(mockConv)   // conversation exists
        .mockResolvedValueOnce(mockMsg);   // INSERT message
      mockDb.execute.mockResolvedValue(1);

      const msg = await messageService.createMessage(convId, {
        message_type: 'internal_note',
        body_text: 'Erster Kontakt aufgenommen',
      }, teamMember.id);
      expect(msg.id).toBe(msgId);

      // Step 3: Mark as read
      mockDb.queryOne
        .mockResolvedValueOnce({ ...mockMsg, read_at: undefined })
        .mockResolvedValueOnce({ ...mockMsg, read_at: new Date() });

      const readMsg = await messageService.markAsRead(msgId, teamMember.id);
      expect(readMsg.read_at).toBeDefined();
    });
  });

  // ===========================================================================
  // 11. Delete Message
  // ===========================================================================

  describe('Nachricht löschen', () => {
    it('erlaubt Löschen eigener Entwürfe', async () => {
      const msgId = uuidv4();
      const msg = createMockMessage({
        id: msgId,
        sender_id: teamMember.id,
        status: 'draft',
      });

      mockDb.queryOne.mockResolvedValueOnce(msg);
      mockDb.execute.mockResolvedValue(1);

      await expect(
        messageService.deleteMessage(msgId, teamMember.id)
      ).resolves.not.toThrow();
    });

    it('verhindert Löschen fremder gesendeter Nachrichten', async () => {
      const msgId = uuidv4();
      const msg = createMockMessage({
        id: msgId,
        sender_id: uuidv4(), // different user
        status: 'sent',
      });

      mockDb.queryOne.mockResolvedValueOnce(msg);

      await expect(
        messageService.deleteMessage(msgId, teamMember.id)
      ).rejects.toThrow('You can only delete your own');
    });
  });

  // ===========================================================================
  // 12. Find By External ID (Deduplication)
  // ===========================================================================

  describe('Deduplication via External ID', () => {
    it('findet Nachricht nach external_id', async () => {
      const externalId = '<msg123@example.com>';
      const msg = createMockMessage({ external_id: externalId });

      mockDb.queryOne.mockResolvedValueOnce(msg);

      const result = await messageService.findByExternalId(externalId);

      expect(result).not.toBeNull();
      expect(result!.external_id).toBe(externalId);
    });

    it('gibt null zurück wenn nicht gefunden', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await messageService.findByExternalId('<unknown@test>');

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // 13. findOrCreateConversation (used by email sync)
  // ===========================================================================

  describe('findOrCreateConversation', () => {
    it('findet existierende aktive Konversation', async () => {
      const convId = uuidv4();
      const existingConv = createMockConversation({ id: convId, deal_id: deal.id, status: 'active' });

      mockDb.queryOne.mockResolvedValueOnce(existingConv);

      const result = await conversationService.findOrCreateConversation(
        lead.id, deal.id, teamMember.id, 'Re: Angebot'
      );

      expect(result.id).toBe(convId);
    });

    it('erstellt neue Konversation wenn keine existiert', async () => {
      const convId = uuidv4();
      const newConv = createMockConversation({
        id: convId,
        deal_id: deal.id,
        lead_id: lead.id,
        subject: 'Neues Gespräch',
      });

      mockDb.queryOne
        .mockResolvedValueOnce(null)    // no existing conversation
        .mockResolvedValueOnce(newConv); // INSERT

      const result = await conversationService.findOrCreateConversation(
        lead.id, deal.id, teamMember.id, 'Neues Gespräch'
      );

      expect(result.id).toBe(convId);
    });

    it('wirft Fehler wenn weder lead_id noch deal_id', async () => {
      await expect(
        conversationService.findOrCreateConversation(null, null, teamMember.id)
      ).rejects.toThrow('Either lead_id or deal_id must be provided');
    });
  });

  // ===========================================================================
  // 14. Conversation Deletion (hard delete)
  // ===========================================================================

  describe('Konversation löschen', () => {
    it('löscht Konversation mit Zugriff', async () => {
      const convId = uuidv4();
      const mockConv = createMockConversation({ id: convId });

      mockDb.queryOne
        .mockResolvedValueOnce({ has_access: true })
        .mockResolvedValueOnce(mockConv);
      mockDb.execute.mockResolvedValueOnce(1);

      await expect(
        conversationService.deleteConversation(convId, teamMember.id, teamMember.email, teamMember.role)
      ).resolves.not.toThrow();

      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('verweigert Löschen ohne Zugriff', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ has_access: false });

      await expect(
        conversationService.deleteConversation(uuidv4(), teamMember.id, teamMember.email, teamMember.role)
      ).rejects.toThrow('access');
    });
  });
});
