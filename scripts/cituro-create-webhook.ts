#!/usr/bin/env tsx
/**
 * Webhook bei Cituro anlegen und Secret aus der Response holen.
 * Trage den Secret danach in .env als CITURO_WEBHOOK_SECRET ein.
 *
 * Aufruf: npm run cituro:create-webhook
 * Voraussetzung: .env mit CITURO_API_KEY und ggf. CITURO_WEBHOOK_ENDPOINT
 */

import 'dotenv/config';

const API_KEY = process.env.CITURO_API_KEY?.trim();
const ENDPOINT = process.env.CITURO_WEBHOOK_ENDPOINT || 'https://crm.dna-me.net/api/webhooks/cituro';

async function main() {
  if (!API_KEY) {
    console.error('❌ CITURO_API_KEY fehlt in .env');
    process.exit(1);
  }

  const body = {
    name: 'CRM Integration',
    endpoint: ENDPOINT,
    active: true,
    eventTypes: ['booking.created']
  };

  console.log('\n=== Cituro Webhook anlegen ===\n');
  console.log('Endpoint:', ENDPOINT);
  console.log('');

  const res = await fetch('https://app.cituro.com/api/webhooks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('❌ Fehler:', res.status, data?.errors?.[0]?.message || data?.message || res.statusText);
    process.exit(1);
  }

  const secret = data?.data?.secret;
  if (!secret) {
    console.log('Response:', JSON.stringify(data, null, 2));
    console.error('❌ In der Response fehlt data.secret');
    process.exit(1);
  }

  console.log('✅ Webhook erstellt.\n');
  console.log('--- CITURO_WEBHOOK_SECRET (in .env eintragen) ---');
  console.log(secret);
  console.log('------------------------------------------------\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
