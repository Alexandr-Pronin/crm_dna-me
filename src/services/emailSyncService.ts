// =============================================================================
// src/services/emailSyncService.ts
// Email Sync Service – IMAP-based email synchronization with improved matching
// Connects to user email accounts, fetches new messages, and routes them into
// the correct conversations using a multi-level matching strategy.
// =============================================================================

import Imap from 'imap';
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser';
import { convert as htmlToText } from 'html-to-text';
import { db } from '../db/index.js';
import { getMessageService, type CreateMessageInput } from './messageService.js';
import { getConversationService } from './conversationService.js';
import { decrypt } from '../utils/crypto.js';
import { isEncrypted } from '../utils/crypto.js';
import type {
  EmailAccount,
  Conversation,
  MessageRecipient,
  MessageAttachment,
} from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

/** Parsed and normalized email ready for matching & storage. */
export interface ParsedEmail {
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  from: { address: string; name: string };
  to: Array<{ address: string; name: string }>;
  cc: Array<{ address: string; name: string }>;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  date: Date;
  attachments: MessageAttachment[];
}

/** Summary result after syncing a single email account. */
export interface SyncResult {
  accountId: string;
  email: string;
  success: boolean;
  newMessages: number;
  skippedDuplicates: number;
  errors: string[];
}

/** Overall result for a full sync run (all accounts). */
export interface SyncRunResult {
  startedAt: Date;
  completedAt: Date;
  accounts: SyncResult[];
  totalNew: number;
  totalErrors: number;
}

// =============================================================================
// Constants
// =============================================================================

const LOG_PREFIX = '[EmailSyncService]';

const IGNORED_SENDER_PATTERNS = [
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^noreply@/i,
  /^no-reply@/i,
  /^bounce[s]?[+-@]/i,
  /^mail-daemon@/i,
  /^auto-reply@/i,
  /^notifications?@.*\.(google|github|linkedin|facebook|twitter|slack)\./i,
];

/** Maximum emails to fetch per sync run per account. */
const MAX_EMAILS_PER_SYNC = 100;

/** IMAP connection timeout in milliseconds. */
const IMAP_CONNECT_TIMEOUT_MS = 30_000;

/** IMAP auth timeout in milliseconds. */
const IMAP_AUTH_TIMEOUT_MS = 15_000;

// =============================================================================
// EmailSyncService Class
// =============================================================================

export class EmailSyncService {
  private messageService = getMessageService();
  private conversationService = getConversationService();

  // ===========================================================================
  // Public: Sync All Enabled Accounts
  // ===========================================================================

  /**
   * Synchronizes all email accounts that have `sync_enabled = true`.
   * Called by the background worker on a schedule (e.g. every 5 minutes).
   */
  async syncAllAccounts(): Promise<SyncRunResult> {
    const startedAt = new Date();
    const results: SyncResult[] = [];

    const accounts = await db.query<EmailAccount>(
      `SELECT * FROM email_accounts
       WHERE sync_enabled = true
         AND imap_host IS NOT NULL
         AND imap_username IS NOT NULL
         AND imap_password IS NOT NULL`,
    );

    console.log(`${LOG_PREFIX} Starting sync run for ${accounts.length} account(s)`);

    for (const account of accounts) {
      try {
        const result = await this.syncEmailAccount(account.id);
        results.push(result);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`${LOG_PREFIX} Fatal error syncing account ${account.email_address}:`, errMsg);
        results.push({
          accountId: account.id,
          email: account.email_address,
          success: false,
          newMessages: 0,
          skippedDuplicates: 0,
          errors: [errMsg],
        });
      }
    }

    const completedAt = new Date();
    const totalNew = results.reduce((sum, r) => sum + r.newMessages, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    console.log(
      `${LOG_PREFIX} Sync run completed: ${totalNew} new message(s), ${totalErrors} error(s) ` +
      `in ${completedAt.getTime() - startedAt.getTime()}ms`
    );

    return { startedAt, completedAt, accounts: results, totalNew, totalErrors };
  }

  // ===========================================================================
  // Public: Sync Single Account
  // ===========================================================================

  /**
   * Syncs a single email account by ID.
   * Updates the account's sync_status / last_sync_at / sync_error fields.
   */
  async syncEmailAccount(accountId: string): Promise<SyncResult> {
    const account = await db.queryOne<EmailAccount>(
      'SELECT * FROM email_accounts WHERE id = $1',
      [accountId],
    );

    if (!account) {
      throw new Error(`Email account ${accountId} not found`);
    }

    const result: SyncResult = {
      accountId: account.id,
      email: account.email_address,
      success: false,
      newMessages: 0,
      skippedDuplicates: 0,
      errors: [],
    };

    // Mark as syncing
    console.log(`${LOG_PREFIX} [${account.email_address}] Marking as syncing...`);
    await this.updateSyncStatus(accountId, 'syncing');
    console.log(`${LOG_PREFIX} [${account.email_address}] Status updated, connecting IMAP...`);

    try {
      // Fetch emails via IMAP
      const rawEmails = await this.fetchNewEmails(account);

      console.log(
        `${LOG_PREFIX} [${account.email_address}] Fetched ${rawEmails.length} email(s) from IMAP`
      );

      // Process each email
      for (const raw of rawEmails) {
        try {
          const parsed = await this.parseEmail(raw);
          const wasDuplicate = await this.processIncomingEmail(parsed, account);
          if (wasDuplicate) {
            result.skippedDuplicates++;
          } else {
            result.newMessages++;
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Parse/process error';
          console.error(`${LOG_PREFIX} [${account.email_address}] Error processing email:`, errMsg);
          result.errors.push(errMsg);
        }
      }

      result.success = true;

      // Update sync status
      await this.updateSyncStatus(accountId, 'idle', null, new Date());

      console.log(
        `${LOG_PREFIX} [${account.email_address}] Sync complete: ` +
        `${result.newMessages} new, ${result.skippedDuplicates} duplicates, ${result.errors.length} errors`
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Sync failed';
      console.error(`${LOG_PREFIX} [${account.email_address}] Sync failed:`, errMsg);
      result.errors.push(errMsg);

      await this.updateSyncStatus(accountId, 'error', errMsg);
    }

    return result;
  }

  // ===========================================================================
  // IMAP: Fetch New Emails
  // ===========================================================================

  /**
   * Connects to the IMAP server and fetches unseen emails since last sync.
   * Returns raw email buffers for parsing.
   */
  private fetchNewEmails(account: EmailAccount): Promise<Buffer[]> {
    return new Promise((resolve, reject) => {
      const imapPassword = this.decryptSafe(account.imap_password!);
      let settled = false;

      const fail = (msg: string) => {
        if (!settled) {
          settled = true;
          reject(new Error(msg));
        }
      };

      const succeed = (data: Buffer[]) => {
        if (!settled) {
          settled = true;
          resolve(data);
        }
      };

      const overallTimeout = setTimeout(() => {
        fail('IMAP operation timed out after 60s');
        try { imap.end(); } catch { /* ignore */ }
      }, 60_000);

      const imap = new Imap({
        user: account.imap_username!,
        password: imapPassword,
        host: account.imap_host!,
        port: account.imap_port ?? 993,
        tls: (account.imap_port ?? 993) === 993,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: IMAP_CONNECT_TIMEOUT_MS,
        authTimeout: IMAP_AUTH_TIMEOUT_MS,
      });

      const emails: Buffer[] = [];

      imap.once('ready', () => {
        console.log(`${LOG_PREFIX} [${account.email_address}] IMAP ready, opening INBOX...`);

        imap.openBox('INBOX', false, (err) => {
          if (err) {
            imap.end();
            return fail(`Failed to open INBOX: ${err.message}`);
          }

          console.log(`${LOG_PREFIX} [${account.email_address}] INBOX open, searching...`);
          const searchCriteria = this.buildSearchCriteria(account.last_sync_at);

          imap.search(searchCriteria, (searchErr, uids) => {
            if (searchErr) {
              imap.end();
              return fail(`IMAP search failed: ${searchErr.message}`);
            }

            if (!uids || uids.length === 0) {
              console.log(`${LOG_PREFIX} [${account.email_address}] No new emails`);
              imap.end();
              return;
            }

            const limitedUids = uids.slice(-MAX_EMAILS_PER_SYNC);
            console.log(`${LOG_PREFIX} [${account.email_address}] Fetching ${limitedUids.length} email(s)...`);

            const fetch = imap.fetch(limitedUids, { bodies: '', struct: true });

            fetch.on('message', (msg) => {
              const chunks: Buffer[] = [];

              msg.on('body', (stream) => {
                stream.on('data', (chunk: Buffer) => {
                  chunks.push(chunk);
                });
              });

              msg.once('end', () => {
                emails.push(Buffer.concat(chunks));
              });
            });

            fetch.once('error', (fetchErr: Error) => {
              imap.end();
              fail(`IMAP fetch failed: ${fetchErr.message}`);
            });

            fetch.once('end', () => {
              imap.end();
            });
          });
        });
      });

      imap.once('error', (err: Error) => {
        fail(`IMAP error: ${err.message}`);
      });

      imap.once('end', () => {
        clearTimeout(overallTimeout);
        succeed(emails);
      });

      imap.connect();
    });
  }

  // ===========================================================================
  // Build IMAP Search Criteria
  // ===========================================================================

  /**
   * Builds IMAP search criteria.
   * If last_sync_at is available, searches for emails since that date.
   * Otherwise falls back to UNSEEN emails only.
   */
  private buildSearchCriteria(lastSyncAt?: Date | null): Array<string | string[]> {
    if (lastSyncAt) {
      // Format date as DD-Mon-YYYY for IMAP SINCE criterion
      const sinceDate = this.formatImapDate(lastSyncAt);
      return [['SINCE', sinceDate]];
    }

    // First sync: only fetch unseen emails
    return ['UNSEEN'];
  }

  /**
   * Formats a Date into IMAP date format: DD-Mon-YYYY
   */
  private formatImapDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = date.getDate();
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  }

  // ===========================================================================
  // Parse Raw Email
  // ===========================================================================

  /**
   * Parses a raw email buffer into a structured ParsedEmail object.
   */
  private async parseEmail(raw: Buffer): Promise<ParsedEmail> {
    const parsed: ParsedMail = await simpleParser(raw);

    const from = this.extractFirstAddress(parsed.from);
    const to = this.extractAddresses(parsed.to);
    const cc = this.extractAddresses(parsed.cc);

    // Extract text from HTML if body_text is missing
    let bodyText = parsed.text ?? null;
    if (!bodyText && parsed.html) {
      bodyText = htmlToText(parsed.html, {
        wordwrap: 120,
        selectors: [
          { selector: 'img', format: 'skip' },
          { selector: 'a', options: { ignoreHref: true } },
        ],
      });
    }

    // Extract attachments
    const attachments: MessageAttachment[] = (parsed.attachments ?? []).map((att) => ({
      filename: att.filename ?? 'unnamed',
      content_type: att.contentType ?? 'application/octet-stream',
      size: att.size ?? 0,
    }));

    // Parse references (can be a string with space-separated IDs or an array)
    let references: string[] = [];
    if (parsed.references) {
      if (Array.isArray(parsed.references)) {
        references = parsed.references;
      } else if (typeof parsed.references === 'string') {
        references = parsed.references.split(/\s+/).filter(Boolean);
      }
    }

    return {
      messageId: parsed.messageId ?? `unknown-${Date.now()}@sync`,
      inReplyTo: (parsed.inReplyTo as string) ?? null,
      references,
      from,
      to,
      cc,
      subject: parsed.subject ?? '(kein Betreff)',
      bodyHtml: (typeof parsed.html === 'string' ? parsed.html : null),
      bodyText,
      date: parsed.date ?? new Date(),
      attachments,
    };
  }

  // ===========================================================================
  // Process Incoming Email
  // ===========================================================================

  /**
   * Processes a parsed email:
   *  1. Deduplicate by external_id (Message-ID)
   *  2. Match to existing conversation (multi-level strategy)
   *  3. Create or find conversation
   *  4. Store as message via MessageService
   *
   * Returns true if the email was a duplicate (skipped).
   */
  private async processIncomingEmail(
    email: ParsedEmail,
    account: EmailAccount
  ): Promise<boolean> {
    // 0. Skip system/bounce senders
    if (IGNORED_SENDER_PATTERNS.some(p => p.test(email.from.address))) {
      console.log(`${LOG_PREFIX} [${account.email_address}] Ignoring system sender: ${email.from.address}`);
      return true;
    }

    // 1. Deduplication check
    const existing = await this.messageService.findByExternalId(email.messageId);
    if (existing) {
      return true; // duplicate
    }

    // 2. Determine direction (inbound vs outbound)
    const isOutbound = this.isOutboundEmail(email, account.email_address);
    const direction = isOutbound ? 'outbound' : 'inbound';

    // 3. Match to conversation
    const conversationId = await this.matchEmailToConversation(email, account);

    if (!conversationId) {
      console.log(
        `${LOG_PREFIX} [${account.email_address}] No matching lead/deal found for email ` +
        `from ${email.from.address} — skipping`
      );
      return false;
    }

    // 4. Build recipients list
    const recipients: MessageRecipient[] = [
      ...email.to.map((r) => ({ email: r.address, name: r.name, type: 'to' as const })),
      ...email.cc.map((r) => ({ email: r.address, name: r.name, type: 'cc' as const })),
    ];

    // 5. Create message via MessageService
    const messageInput: CreateMessageInput = {
      message_type: 'email',
      direction,
      sender_email: email.from.address,
      sender_name: email.from.name,
      recipients,
      subject: email.subject,
      body_html: email.bodyHtml ?? undefined,
      body_text: email.bodyText ?? undefined,
      external_id: email.messageId,
      email_thread_id: email.inReplyTo ?? undefined,
      skip_send: true, // imported email, don't re-send
      sent_at: email.date.toISOString(),
      metadata: {
        sync_source: 'imap',
        account_id: account.id,
        references: email.references,
      },
      attachments: email.attachments.length > 0 ? email.attachments : undefined,
    };

    await this.messageService.createMessage(
      conversationId,
      messageInput,
      account.team_member_id, // sender_id = the team member who owns the account
    );

    return false; // not a duplicate
  }

  // ===========================================================================
  // Match Email to Conversation – Multi-Level Strategy
  // ===========================================================================

  /**
   * Attempts to match an incoming email to an existing conversation
   * using a prioritized multi-level strategy:
   *
   *  1. In-Reply-To / References header (most reliable)
   *  2. Subject contains a Deal-ID tag (e.g. [#DEAL-abc123])
   *  3. Active deal with matching email contact
   *  4. Lead-level conversation (no deal)
   *  5. Create new conversation if a matching lead exists
   *
   * Returns the conversation ID, or null if no matching lead/deal was found.
   */
  async matchEmailToConversation(
    email: ParsedEmail,
    account: EmailAccount
  ): Promise<string | null> {

    // Determine the "contact" email — the external party
    const contactEmail = this.isOutboundEmail(email, account.email_address)
      ? this.findExternalRecipient(email, account.email_address)
      : email.from.address;

    if (!contactEmail) return null;

    // -------------------------------------------------------------------------
    // Strategy 1: In-Reply-To header → find message with matching external_id
    //             or email_thread_id
    // -------------------------------------------------------------------------
    if (email.inReplyTo) {
      const match = await this.matchByInReplyTo(email.inReplyTo);
      if (match) return match;
    }

    // Also try all references
    for (const ref of email.references) {
      const match = await this.matchByInReplyTo(ref);
      if (match) return match;
    }

    // -------------------------------------------------------------------------
    // Strategy 2: Subject contains Deal-ID tag, e.g. [#DEAL-<uuid>]
    // -------------------------------------------------------------------------
    const dealIdFromSubject = this.extractDealIdFromSubject(email.subject);
    if (dealIdFromSubject) {
      const match = await this.matchByDealId(dealIdFromSubject);
      if (match) return match;
    }

    // -------------------------------------------------------------------------
    // Strategy 3: Active deal with this email contact
    // -------------------------------------------------------------------------
    const dealMatch = await this.matchByActiveDeal(contactEmail);
    if (dealMatch) return dealMatch;

    // -------------------------------------------------------------------------
    // Strategy 4: Existing lead-level conversation (no deal)
    // -------------------------------------------------------------------------
    const leadConversationMatch = await this.matchByLeadConversation(contactEmail);
    if (leadConversationMatch) return leadConversationMatch;

    // -------------------------------------------------------------------------
    // Strategy 5: Find lead by email (or auto-create) and create conversation
    // -------------------------------------------------------------------------
    return this.createConversationForLead(contactEmail, email.subject, account.team_member_id, email.from.name);
  }

  // ===========================================================================
  // Matching Strategies
  // ===========================================================================

  /**
   * Strategy 1: Match by In-Reply-To or References header.
   * Looks for an existing message whose external_id or email_thread_id
   * matches the given Message-ID reference.
   */
  private async matchByInReplyTo(reference: string): Promise<string | null> {
    const match = await db.queryOne<{ conversation_id: string }>(
      `SELECT conversation_id FROM messages
       WHERE external_id = $1 OR email_thread_id = $1
       LIMIT 1`,
      [reference],
    );
    return match?.conversation_id ?? null;
  }

  /**
   * Strategy 2: Extract Deal-ID from the subject line.
   * Looks for patterns like [#DEAL-abc123] or [DEAL-abc123].
   */
  private extractDealIdFromSubject(subject: string): string | null {
    // Match [#DEAL-<uuid or alphanumeric>] in subject
    const match = subject.match(/\[#?DEAL-([a-zA-Z0-9-]+)\]/i);
    return match?.[1] ?? null;
  }

  /**
   * Strategy 2b: Find active conversation linked to a deal by deal ID.
   */
  private async matchByDealId(dealId: string): Promise<string | null> {
    const match = await db.queryOne<{ id: string }>(
      `SELECT id FROM conversations
       WHERE deal_id = $1 AND status = 'active'
       ORDER BY last_message_at DESC NULLS LAST
       LIMIT 1`,
      [dealId],
    );
    return match?.id ?? null;
  }

  /**
   * Strategy 3: Find conversation via active deal linked to lead whose email matches.
   * Prefers the most recently active conversation.
   */
  private async matchByActiveDeal(contactEmail: string): Promise<string | null> {
    const matches = await db.query<{ id: string }>(
      `SELECT c.id FROM conversations c
       JOIN deals d ON d.id = c.deal_id
       JOIN leads l ON l.id = d.lead_id
       WHERE l.email = $1
         AND d.status = 'open'
         AND c.status = 'active'
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [contactEmail],
    );

    if (matches.length > 0) {
      return matches[0].id;
    }

    return null;
  }

  /**
   * Strategy 4: Find existing lead-level conversation (without deal).
   */
  private async matchByLeadConversation(contactEmail: string): Promise<string | null> {
    const match = await db.queryOne<{ id: string }>(
      `SELECT c.id FROM conversations c
       JOIN leads l ON l.id = c.lead_id
       WHERE l.email = $1
         AND c.deal_id IS NULL
         AND c.status = 'active'
       ORDER BY c.last_message_at DESC NULLS LAST
       LIMIT 1`,
      [contactEmail],
    );

    return match?.id ?? null;
  }

  /**
   * Strategy 5: Find a lead by email and create a new conversation.
   * If no lead exists, auto-creates one from the email metadata.
   */
  private async createConversationForLead(
    contactEmail: string,
    subject: string,
    createdById: string,
    senderName?: string,
  ): Promise<string | null> {
    let lead = await db.queryOne<{ id: string }>(
      'SELECT id FROM leads WHERE email = $1',
      [contactEmail],
    );

    if (!lead) {
      const nameParts = (senderName || '').split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || contactEmail.split('@')[0];
      const lastName = nameParts.slice(1).join(' ') || null;

      lead = await db.queryOne<{ id: string }>(
        `INSERT INTO leads (
          email, first_name, last_name, status, lifecycle_stage,
          first_touch_source, first_touch_date, created_at, updated_at
        ) VALUES ($1, $2, $3, 'new', 'subscriber', 'inbound_email', NOW(), NOW(), NOW())
        RETURNING id`,
        [contactEmail, firstName, lastName],
      );

      console.log(
        `${LOG_PREFIX} Auto-created lead for unknown sender ${contactEmail} (id=${lead?.id})`
      );
    }

    // Check if there's a deal for this lead to link to
    const deal = await db.queryOne<{ id: string }>(
      `SELECT id FROM deals
       WHERE lead_id = $1 AND status = 'open'
       ORDER BY created_at DESC
       LIMIT 1`,
      [lead.id],
    );

    // Use ConversationService.findOrCreateConversation
    const conversation = await this.conversationService.findOrCreateConversation(
      lead.id,
      deal?.id ?? null,
      createdById,
      subject,
    );

    return conversation.id;
  }

  // ===========================================================================
  // Helper: Determine Email Direction
  // ===========================================================================

  /**
   * Determines whether the email was sent by our team member (outbound)
   * or received from an external party (inbound).
   */
  private isOutboundEmail(email: ParsedEmail, accountEmail: string): boolean {
    return email.from.address.toLowerCase() === accountEmail.toLowerCase();
  }

  /**
   * For outbound emails, finds the primary external recipient.
   */
  private findExternalRecipient(email: ParsedEmail, accountEmail: string): string | null {
    const normalizedAccount = accountEmail.toLowerCase();

    // Look through TO recipients first, then CC
    for (const recipient of [...email.to, ...email.cc]) {
      if (recipient.address.toLowerCase() !== normalizedAccount) {
        return recipient.address;
      }
    }

    return null;
  }

  // ===========================================================================
  // Helper: Extract Addresses from mailparser AddressObject
  // ===========================================================================

  private extractFirstAddress(
    addressObj: AddressObject | AddressObject[] | undefined
  ): { address: string; name: string } {
    if (!addressObj) {
      return { address: 'unknown@unknown.com', name: 'Unknown' };
    }

    const list = Array.isArray(addressObj) ? addressObj : [addressObj];

    for (const group of list) {
      if (group.value && group.value.length > 0) {
        const first = group.value[0];
        return {
          address: first.address ?? 'unknown@unknown.com',
          name: first.name ?? first.address ?? 'Unknown',
        };
      }
    }

    return { address: 'unknown@unknown.com', name: 'Unknown' };
  }

  private extractAddresses(
    addressObj: AddressObject | AddressObject[] | undefined
  ): Array<{ address: string; name: string }> {
    if (!addressObj) return [];

    const list = Array.isArray(addressObj) ? addressObj : [addressObj];
    const result: Array<{ address: string; name: string }> = [];

    for (const group of list) {
      if (group.value) {
        for (const addr of group.value) {
          if (addr.address) {
            result.push({
              address: addr.address,
              name: addr.name ?? addr.address,
            });
          }
        }
      }
    }

    return result;
  }

  // ===========================================================================
  // Helper: Update Account Sync Status
  // ===========================================================================

  private async updateSyncStatus(
    accountId: string,
    status: 'idle' | 'syncing' | 'error',
    errorMessage?: string | null,
    lastSyncAt?: Date
  ): Promise<void> {
    const setClauses = ['sync_status = $2', 'updated_at = NOW()'];
    const params: unknown[] = [accountId, status];
    let paramIdx = 3;

    if (errorMessage !== undefined) {
      setClauses.push(`sync_error = $${paramIdx}`);
      params.push(errorMessage);
      paramIdx++;
    } else if (status !== 'error') {
      setClauses.push('sync_error = NULL');
    }

    if (lastSyncAt) {
      setClauses.push(`last_sync_at = $${paramIdx}`);
      params.push(lastSyncAt.toISOString());
      paramIdx++;
    }

    await db.execute(
      `UPDATE email_accounts SET ${setClauses.join(', ')} WHERE id = $1`,
      params,
    );
  }

  // ===========================================================================
  // Helper: Safe Decrypt
  // ===========================================================================

  private decryptSafe(value: string): string {
    try {
      if (isEncrypted(value)) {
        return decrypt(value);
      }
      return value;
    } catch {
      // If decryption fails, assume plaintext (dev/migration scenario)
      return value;
    }
  }

  // ===========================================================================
  // Public: Get Account Sync Status
  // ===========================================================================

  async getAccountStatus(accountId: string): Promise<Pick<
    EmailAccount,
    'sync_status' | 'sync_error' | 'last_sync_at' | 'sync_enabled'
  > | null> {
    return db.queryOne<Pick<
      EmailAccount,
      'sync_status' | 'sync_error' | 'last_sync_at' | 'sync_enabled'
    >>(
      `SELECT sync_status, sync_error, last_sync_at, sync_enabled
       FROM email_accounts WHERE id = $1`,
      [accountId],
    );
  }

  // ===========================================================================
  // Public: Test IMAP Connection
  // ===========================================================================

  /**
   * Tests the IMAP connection for an email account without actually syncing.
   * Useful for validating credentials on account setup.
   */
  async testImapConnection(accountId: string): Promise<{ success: boolean; error?: string }> {
    const account = await db.queryOne<EmailAccount>(
      'SELECT * FROM email_accounts WHERE id = $1',
      [accountId],
    );

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    if (!account.imap_host || !account.imap_username || !account.imap_password) {
      return { success: false, error: 'IMAP configuration incomplete' };
    }

    return new Promise((resolve) => {
      const imapPassword = this.decryptSafe(account.imap_password!);

      const imap = new Imap({
        user: account.imap_username!,
        password: imapPassword,
        host: account.imap_host!,
        port: account.imap_port ?? 993,
        tls: (account.imap_port ?? 993) === 993,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: IMAP_CONNECT_TIMEOUT_MS,
        authTimeout: IMAP_AUTH_TIMEOUT_MS,
      });

      imap.once('ready', () => {
        imap.end();
        resolve({ success: true });
      });

      imap.once('error', (err: Error) => {
        resolve({ success: false, error: err.message });
      });

      imap.connect();
    });
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let emailSyncServiceInstance: EmailSyncService | null = null;

export function getEmailSyncService(): EmailSyncService {
  if (!emailSyncServiceInstance) {
    emailSyncServiceInstance = new EmailSyncService();
  }
  return emailSyncServiceInstance;
}

export const emailSyncService = {
  get instance() {
    return getEmailSyncService();
  },
};

export default emailSyncService;
