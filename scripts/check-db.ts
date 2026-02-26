
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const res = await pool.query("SELECT to_regclass('public.team_members');");
    console.log('Table exists:', res.rows[0].to_regclass);
    
    // Check migrations table
    const res2 = await pool.query("SELECT * FROM pgmigrations;");
    console.log('Migrations:', res2.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

check();
