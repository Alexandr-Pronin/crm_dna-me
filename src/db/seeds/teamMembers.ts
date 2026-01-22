// =============================================================================
// src/db/seeds/teamMembers.ts
// Team Members Seed Data
// =============================================================================

import { db, closePool } from '../index.js';

// =============================================================================
// Team Members Data
// =============================================================================

const TEAM_MEMBERS = [
  // BDRs (Business Development Representatives) - Research Lab
  {
    email: 'sarah.mueller@dna-me.com',
    name: 'Sarah Müller',
    role: 'bdr',
    region: 'DACH',
    is_active: true,
    max_leads: 50
  },
  {
    email: 'thomas.schmidt@dna-me.com',
    name: 'Thomas Schmidt',
    role: 'bdr',
    region: 'DACH',
    is_active: true,
    max_leads: 50
  },
  {
    email: 'emma.johnson@dna-me.com',
    name: 'Emma Johnson',
    role: 'bdr',
    region: 'UK',
    is_active: true,
    max_leads: 40
  },
  
  // AEs (Account Executives) - B2B Lab
  {
    email: 'max.weber@dna-me.com',
    name: 'Max Weber',
    role: 'ae',
    region: 'DACH',
    is_active: true,
    max_leads: 30
  },
  {
    email: 'julia.fischer@dna-me.com',
    name: 'Julia Fischer',
    role: 'ae',
    region: 'DACH',
    is_active: true,
    max_leads: 30
  },
  {
    email: 'james.wilson@dna-me.com',
    name: 'James Wilson',
    role: 'ae',
    region: 'UK',
    is_active: true,
    max_leads: 25
  },
  
  // Partnership Manager - Co-Creation
  {
    email: 'anna.becker@dna-me.com',
    name: 'Anna Becker',
    role: 'partnership_manager',
    region: null,
    is_active: true,
    max_leads: 20
  },
  
  // Marketing Manager - Discovery/Fallback
  {
    email: 'michael.koch@dna-me.com',
    name: 'Michael Koch',
    role: 'marketing_manager',
    region: null,
    is_active: true,
    max_leads: 100
  }
];

// =============================================================================
// Seed Function
// =============================================================================

export async function seedTeamMembers(): Promise<void> {
  console.log('Seeding team members...');
  
  try {
    // Clear existing team members (optional - comment out if you want to keep existing)
    await db.execute('DELETE FROM team_members');
    console.log('Cleared existing team members');
    
    // Insert team members
    for (const member of TEAM_MEMBERS) {
      await db.execute(`
        INSERT INTO team_members (email, name, role, region, is_active, max_leads, current_leads, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 0, NOW())
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          region = EXCLUDED.region,
          is_active = EXCLUDED.is_active,
          max_leads = EXCLUDED.max_leads
      `, [
        member.email,
        member.name,
        member.role,
        member.region,
        member.is_active,
        member.max_leads
      ]);
      
      console.log(`  ✅ ${member.name} (${member.role})`);
    }
    
    console.log(`\n✅ Seeded ${TEAM_MEMBERS.length} team members`);
    
    // Show summary
    const summary = await db.query<{ role: string; count: string }>(`
      SELECT role, COUNT(*) as count FROM team_members GROUP BY role ORDER BY role
    `);
    
    console.log('\nTeam composition:');
    for (const row of summary) {
      console.log(`  - ${row.role}: ${row.count}`);
    }
    
  } catch (error) {
    console.error('Error seeding team members:', error);
    throw error;
  }
}

// =============================================================================
// Run if executed directly
// =============================================================================

// Check if this file is being run directly
const isMainModule = process.argv[1]?.includes('teamMembers');

if (isMainModule) {
  seedTeamMembers()
    .then(() => {
      console.log('\nTeam members seeding completed!');
      return closePool();
    })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export default seedTeamMembers;
