#!/usr/bin/env tsx
/**
 * Cituro-Integration testen
 * Prüft: Verbindung, syncCituroClient, createMeetingWithLead
 *
 * Voraussetzung: .env mit CITURO_API_KEY und optional CITURO_SERVICE_ID
 * Aufruf: npm run test:cituro
 *         oder: npx tsx scripts/test-cituro.ts
 */

import 'dotenv/config';
import { getCituroService, CituroError } from '../src/integrations/cituro.js';

async function main() {
  console.log('\n=== Cituro-Integration Test ===\n');

  const apiKey = process.env.CITURO_API_KEY?.trim();
  if (!apiKey) {
    console.error('❌ CITURO_API_KEY fehlt in .env');
    process.exit(1);
  }

  const cituro = getCituroService();

  // --- 1. Verbindung ---
  console.log('1. Verbindung testen...');
  try {
    const result = await cituro.testConnection();
    if (result.connected) {
      console.log('   ✅ Verbindung OK\n');
    } else {
      console.error('   ❌', result.error);
      process.exit(1);
    }
  } catch (e) {
    console.error('   ❌', e instanceof CituroError ? e.cituroMessage || e.message : (e as Error).message);
    process.exit(1);
  }

  // --- 2. Sync Client (Get or Create) ---
  const testEmail = process.env.CITURO_TEST_EMAIL || 'test-crm-' + Date.now() + '@example.com';
  console.log('2. syncCituroClient (Test-Lead)...');
  console.log('   E-Mail:', testEmail);
  let customerId: string;
  try {
    customerId = await cituro.syncCituroClient({
      email: testEmail,
      first_name: 'Test',
      last_name: 'CRM',
      phone: '+49123456789'
    });
    console.log('   ✅ customerId:', customerId, '\n');
  } catch (e) {
    console.error('   ❌', e instanceof CituroError ? e.cituroMessage || e.message : (e as Error).message);
    process.exit(1);
  }

  // --- 3. Meeting anlegen (nur wenn CITURO_SERVICE_ID gesetzt) ---
  if (!process.env.CITURO_SERVICE_ID?.trim()) {
    console.log('3. createMeetingWithLead – übersprungen (CITURO_SERVICE_ID nicht gesetzt)\n');
    console.log('   Um Termine zu testen: CITURO_SERVICE_ID in .env setzen (UUID des "Meeting with Lead"-Services).\n');
  } else {
    const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // morgen
    startTime.setHours(10, 0, 0, 0);
    console.log('3. createMeetingWithLead...');
    console.log('   Start:', startTime.toISOString());
    try {
      const { appointmentId } = await cituro.createMeetingWithLead(customerId, startTime, { durationMinutes: 30 });
      console.log('   ✅ appointmentId:', appointmentId, '\n');
    } catch (e) {
      console.error('   ❌', e instanceof CituroError ? e.cituroMessage || e.message : (e as Error).message);
      process.exit(1);
    }
  }

  console.log('=== Alle Cituro-Tests bestanden ===\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
