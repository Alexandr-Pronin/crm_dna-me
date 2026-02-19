#!/usr/bin/env npx tsx
/**
 * Test für Notification Worker
 * Testet E-Mail- und Slack-Benachrichtigungen
 */

import 'dotenv/config';
import { getNotificationsQueue } from '../src/config/queues.js';
import { getRedisConnection } from '../src/config/redis.js';

async function main() {
  console.log('\n=== Notification Worker Test ===\n');

  try {
    // Redis verbinden
    const redis = getRedisConnection();
    console.log('✅ Redis verbunden');

    // Notifications Queue holen
    const queue = getNotificationsQueue();
    console.log('✅ Notifications Queue geladen');

    // Test 1: Slack-Benachrichtigung
    console.log('\n1. Sende Test-Slack-Benachrichtigung...');
    await queue.add('slack_notification', {
      channel: '#crm-notifications',
      message: '🧪 Test-Benachrichtigung vom Notification Worker',
      metadata: { test: true, timestamp: new Date().toISOString() }
    });
    console.log('✅ Slack-Job zur Queue hinzugefügt');

    // Test 2: E-Mail-Benachrichtigung (optional)
    const testEmail = process.argv.find(a => a.startsWith('--email='))?.split('=')[1];
    if (testEmail) {
      console.log(`\n2. Sende Test-E-Mail an ${testEmail}...`);
      await queue.add('email_notification', {
        to: testEmail,
        subject: '[DNA ME] Notification Worker Test',
        html: '<h2>Test-E-Mail</h2><p>Diese E-Mail wurde vom Notification Worker gesendet.</p>'
      });
      console.log('✅ E-Mail-Job zur Queue hinzugefügt');
    }

    console.log('\n✅ Alle Jobs zur Queue hinzugefügt. Prüfen Sie die Worker-Logs.');
    console.log('   Tipp: Verwenden Sie --email=ihre@email.de, um auch eine Test-E-Mail zu senden.\n');

    // Warte kurz, dann schließen
    await new Promise(resolve => setTimeout(resolve, 2000));
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fehler:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
