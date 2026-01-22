// =============================================================================
// src/db/seeds/scoringRules.ts
// Seed Script for Scoring Rules
// =============================================================================

import 'dotenv/config';
import { db, closePool } from '../index.js';
import { DEFAULT_SCORING_RULES, type ScoringRuleDefinition } from '../../config/scoringRules.js';

// =============================================================================
// Seed Function
// =============================================================================

async function seedScoringRules(): Promise<void> {
  console.log('🌱 Seeding scoring rules...\n');

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const rule of DEFAULT_SCORING_RULES) {
    try {
      // Check if rule already exists
      const existing = await db.queryOne<{ id: string }>(`
        SELECT id FROM scoring_rules WHERE slug = $1
      `, [rule.slug]);

      if (existing) {
        // Update existing rule
        await db.execute(`
          UPDATE scoring_rules SET
            name = $2,
            description = $3,
            rule_type = $4,
            category = $5,
            conditions = $6,
            points = $7,
            max_per_day = $8,
            max_per_lead = $9,
            decay_days = $10,
            priority = $11,
            updated_at = NOW()
          WHERE slug = $1
        `, [
          rule.slug,
          rule.name,
          rule.description,
          rule.rule_type,
          rule.category,
          JSON.stringify(rule.conditions),
          rule.points,
          rule.max_per_day ?? null,
          rule.max_per_lead ?? null,
          rule.decay_days ?? null,
          rule.priority ?? 100
        ]);
        updated++;
        console.log(`  ✓ Updated: ${rule.slug} (${rule.category}, +${rule.points})`);
      } else {
        // Insert new rule
        await db.execute(`
          INSERT INTO scoring_rules (
            slug, name, description, is_active, priority,
            rule_type, category, conditions, points,
            max_per_day, max_per_lead, decay_days
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          rule.slug,
          rule.name,
          rule.description,
          true,
          rule.priority ?? 100,
          rule.rule_type,
          rule.category,
          JSON.stringify(rule.conditions),
          rule.points,
          rule.max_per_day ?? null,
          rule.max_per_lead ?? null,
          rule.decay_days ?? null
        ]);
        inserted++;
        console.log(`  + Inserted: ${rule.slug} (${rule.category}, +${rule.points})`);
      }
    } catch (error) {
      console.error(`  ✗ Error with rule ${rule.slug}:`, error);
      skipped++;
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log(`✅ Scoring rules seeded successfully!`);
  console.log(`   - Inserted: ${inserted}`);
  console.log(`   - Updated: ${updated}`);
  console.log(`   - Skipped/Errors: ${skipped}`);
  console.log(`   - Total rules: ${DEFAULT_SCORING_RULES.length}`);
  console.log('────────────────────────────────────────\n');

  // Show summary by category
  const summary = DEFAULT_SCORING_RULES.reduce((acc, rule) => {
    acc[rule.category] = (acc[rule.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Rules by category:');
  for (const [category, count] of Object.entries(summary)) {
    console.log(`  - ${category}: ${count} rules`);
  }
}

// =============================================================================
// Run Seed
// =============================================================================

async function main() {
  try {
    // Verify database connection
    const healthy = await db.healthCheck();
    if (!healthy) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connected\n');

    await seedScoringRules();

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await closePool();
    console.log('\n✅ Database connection closed');
  }
}

main();
