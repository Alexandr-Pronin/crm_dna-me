import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const MIGRATION_FILE = process.argv[2] || '1771350000000_add_chat_system.sql';

async function run() {
  try {
    const sqlPath = path.join(process.cwd(), 'migrations', MIGRATION_FILE);

    if (!fs.existsSync(sqlPath)) {
      console.error(`Migration file not found: ${sqlPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    const upSql = sql.split('-- Down Migration')[0];

    const migrationName = MIGRATION_FILE.replace('.sql', '');

    const existing = await pool.query(
      'SELECT 1 FROM pgmigrations WHERE name = $1',
      [migrationName]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`Migration "${migrationName}" already applied. Skipping.`);
      return;
    }

    console.log(`Running migration: ${migrationName}`);
    console.log('SQL:', upSql.substring(0, 200) + '...');

    await pool.query(upSql);
    console.log('Migration executed successfully.');

    await pool.query('INSERT INTO pgmigrations (name, run_on) VALUES ($1, NOW())', [migrationName]);
    console.log('pgmigrations table updated.');

  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
