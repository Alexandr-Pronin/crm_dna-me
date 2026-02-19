#!/usr/bin/env npx ts-node
/**
 * SMTP-Verbindungstest
 * Verwendet dieselbe Konfiguration wie die App (.env)
 *
 * Ausführung: npx ts-node scripts/test-smtp.ts
 * Oder: npm run test:smtp (falls in package.json definiert)
 */

import 'dotenv/config';
import nodemailer from 'nodemailer';

async function main() {
  const host = process.env.SMTP_HOST?.trim();
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  console.log('\n=== SMTP-Verbindungstest ===\n');
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`User: ${user}`);
  console.log(`Secure (SSL/TLS): ${secure}\n`);

  if (!host || !user || !pass) {
    console.error('❌ Fehler: SMTP_HOST, SMTP_USER und SMTP_PASS müssen in .env gesetzt sein.');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  try {
    console.log('Verbindung zum SMTP-Server...');
    await transporter.verify();
    console.log('✅ SMTP-Verbindung erfolgreich! Der Server akzeptiert die Anmeldedaten.\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ SMTP-Verbindung fehlgeschlagen:', msg);
    console.error('\nMögliche Ursachen:');
    console.error('  - Falscher Host, Port oder Anmeldedaten');
    console.error('  - Firewall blockiert ausgehende Verbindungen (Port 465/587)');
    console.error('  - SMTP-Server erlaubt keine App-Passwörter (z.B. 2FA bei Gmail)');
    console.error('  - Manitu: Prüfen Sie, ob das Konto aktiv ist und das Passwort stimmt\n');
    process.exit(1);
  }

  // Optional: Test-E-Mail senden
  const testSend = process.argv.includes('--send');
  if (testSend) {
    const to = process.argv.find((a) => a.startsWith('--to='))?.split('=')[1] || user;
    console.log(`Sende Test-E-Mail an ${to}...`);
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || user,
        to,
        subject: '[DNA ME] SMTP-Test',
        text: 'Dies ist eine Test-E-Mail vom SMTP-Verbindungstest.',
      });
      console.log('✅ Test-E-Mail gesendet:', info.messageId);
    } catch (err) {
      console.error('❌ E-Mail-Versand fehlgeschlagen:', (err as Error).message);
      process.exit(1);
    }
  } else {
    console.log('Tipp: Mit --send und optional --to=email@example.com eine Test-E-Mail senden.');
  }

  transporter.close();
}

main();
