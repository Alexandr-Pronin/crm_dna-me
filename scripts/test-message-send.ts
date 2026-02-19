#!/usr/bin/env npx tsx
/**
 * Test für direkten E-Mail-Versand über MessageService
 */

import 'dotenv/config';
import { getMessageService } from '../src/services/messageService.js';
import { db } from '../src/db/index.js';

async function main() {
  console.log('\n=== MessageService E-Mail Test ===\n');

  try {
    // Finde eine Test-Conversation
    const conversation = await db.queryOne<{ id: string; lead_id: string }>(
      'SELECT id, lead_id FROM conversations LIMIT 1'
    );

    if (!conversation) {
      console.error('❌ Keine Conversation gefunden. Erstellen Sie zuerst eine Conversation.');
      process.exit(1);
    }

    console.log(`✅ Test-Conversation gefunden: ${conversation.id}`);

    // Hole Lead-E-Mail
    const lead = await db.queryOne<{ email: string; first_name: string | null }>(
      'SELECT email, first_name FROM leads WHERE id = $1',
      [conversation.lead_id]
    );

    if (!lead) {
      console.error('❌ Lead nicht gefunden');
      process.exit(1);
    }

    console.log(`✅ Lead gefunden: ${lead.email}`);
    console.log(`\nSende Test-E-Mail an ${lead.email}...\n`);

    const messageService = getMessageService();
    const message = await messageService.createMessage(
      conversation.id,
      {
        message_type: 'email',
        direction: 'outbound',
        subject: '[DNA ME] Test-E-Mail vom MessageService',
        body_text: `Hallo ${lead.first_name || 'dort'},\n\nDies ist eine Test-E-Mail vom MessageService.`,
        body_html: `<p>Hallo ${lead.first_name || 'dort'},</p><p>Dies ist eine Test-E-Mail vom MessageService.</p>`,
      },
      undefined // Kein userId
    );

    console.log(`✅ Nachricht erstellt: ${message.id}`);
    console.log(`   Status: ${message.status}`);
    console.log(`   Type: ${message.message_type}`);

    // Warte 3 Sekunden für async-Versand
    console.log('\n⏳ Warte 3 Sekunden auf asynchronen E-Mail-Versand...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Prüfe Status erneut
    const updated = await db.queryOne<{ status: string; error_message: string | null; sent_at: Date | null }>(
      'SELECT status, error_message, sent_at FROM messages WHERE id = $1',
      [message.id]
    );

    console.log(`✅ Status nach 3s: ${updated?.status}`);
    if (updated?.sent_at) {
      console.log(`   Gesendet am: ${updated.sent_at}`);
    }
    if (updated?.error_message) {
      console.log(`   Fehler: ${updated.error_message}`);
    }

    if (updated?.status === 'sent') {
      console.log('\n✅ E-Mail erfolgreich gesendet!\n');
    } else {
      console.log(`\n⚠️ E-Mail-Status: ${updated?.status}\n`);
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fehler:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

main();
