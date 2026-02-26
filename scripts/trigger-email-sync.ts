#!/usr/bin/env npx tsx
import 'dotenv/config';
import { Queue } from 'bullmq';

async function main() {
  const queue = new Queue('email-sync', {
    connection: { host: 'localhost', port: 6379 },
  });

  const job = await queue.add('manual-sync', { 
    type: 'sync_all_accounts', 
    triggeredBy: 'manual' 
  });
  console.log(`✅ Job hinzugefügt: id=${job.id}`);
  
  const counts = await queue.getJobCounts();
  console.log('Queue-Status:', JSON.stringify(counts));
  
  await new Promise(r => setTimeout(r, 2000));
  await queue.close();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fehler:', err.message);
  process.exit(1);
});
