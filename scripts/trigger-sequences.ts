#!/usr/bin/env npx tsx
import 'dotenv/config';
import { Queue } from 'bullmq';

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

async function main() {
  const queue = new Queue('email-sequence', { connection: redisOptions });
  await queue.add('manual-trigger', { type: 'process_due_emails' });
  console.log('✅ Job zur email-sequence Queue hinzugefügt');
  
  await new Promise(r => setTimeout(r, 2000));
  await queue.close();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fehler:', err.message);
  process.exit(1);
});
