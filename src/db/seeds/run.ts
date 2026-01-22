// =============================================================================
// src/db/seeds/run.ts
// Database Seeding Script
// =============================================================================

import { db, closePool } from '../index.js';
import { seedAutomationRules } from './automationRules.js';

console.log('🌱 Starting database seeding...\n');

async function seedScoringRules() {
  console.log('Seeding scoring rules...');

  const rules = [
    // Demographic Scoring
    {
      slug: 'demo-academic-email',
      name: 'Academic Email Domain',
      description: 'Points for .edu, .ac.*, uni-* email domains',
      rule_type: 'lead_field',
      category: 'demographic',
      conditions: { field: 'email', operator: 'pattern', value: '\\.(edu|ac\\.|uni-)' },
      points: 15,
      max_per_lead: 1
    },
    {
      slug: 'demo-corporate-email',
      name: 'Corporate Email Domain',
      description: 'Points for non-free email domains',
      rule_type: 'lead_field',
      category: 'demographic',
      conditions: { field: 'email', operator: 'not_pattern', value: '(gmail|yahoo|hotmail|outlook)' },
      points: 10,
      max_per_lead: 1
    },
    {
      slug: 'demo-decision-maker-title',
      name: 'Decision Maker Title',
      description: 'Points for VP, Director, Head of titles',
      rule_type: 'lead_field',
      category: 'demographic',
      conditions: { field: 'job_title', operator: 'contains', value: ['VP', 'Director', 'Head of', 'Chief', 'Manager'] },
      points: 20,
      max_per_lead: 1
    },
    {
      slug: 'demo-researcher-title',
      name: 'Researcher Title',
      description: 'Points for PhD, Professor, Researcher titles',
      rule_type: 'lead_field',
      category: 'demographic',
      conditions: { field: 'job_title', operator: 'contains', value: ['PhD', 'PostDoc', 'Researcher', 'Professor', 'PI', 'Scientist'] },
      points: 15,
      max_per_lead: 1
    },

    // Engagement Scoring
    {
      slug: 'eng-page-visit',
      name: 'Page Visit',
      description: 'Points for any page visit',
      rule_type: 'event',
      category: 'engagement',
      conditions: { event_type: 'page_visited' },
      points: 2,
      max_per_day: 10,
      decay_days: 30
    },
    {
      slug: 'eng-pricing-page',
      name: 'Pricing Page Visit',
      description: 'High-intent pricing page visit',
      rule_type: 'event',
      category: 'engagement',
      conditions: { event_type: 'page_visited', metadata: { page_path: '/pricing' } },
      points: 15,
      max_per_day: 3,
      decay_days: 14
    },
    {
      slug: 'eng-email-open',
      name: 'Email Opened',
      description: 'Points for opening marketing email',
      rule_type: 'event',
      category: 'engagement',
      conditions: { event_type: 'email_opened' },
      points: 3,
      max_per_day: 5,
      decay_days: 30
    },
    {
      slug: 'eng-email-click',
      name: 'Email Link Clicked',
      description: 'Points for clicking link in email',
      rule_type: 'event',
      category: 'engagement',
      conditions: { event_type: 'email_clicked' },
      points: 8,
      max_per_day: 5,
      decay_days: 21
    },
    {
      slug: 'eng-linkedin-accepted',
      name: 'LinkedIn Connection Accepted',
      description: 'Points for accepting LinkedIn connection',
      rule_type: 'event',
      category: 'engagement',
      conditions: { event_type: 'linkedin_connection_accepted' },
      points: 10,
      max_per_lead: 1
    },
    {
      slug: 'eng-linkedin-reply',
      name: 'LinkedIn Message Reply',
      description: 'High-intent LinkedIn reply',
      rule_type: 'event',
      category: 'engagement',
      conditions: { event_type: 'linkedin_message_replied' },
      points: 25,
      max_per_day: 3,
      decay_days: 14
    },

    // Behavior Scoring
    {
      slug: 'beh-form-submit',
      name: 'Form Submission',
      description: 'Points for submitting any form',
      rule_type: 'event',
      category: 'behavior',
      conditions: { event_type: 'form_submitted' },
      points: 20,
      max_per_day: 3,
      decay_days: 30
    },
    {
      slug: 'beh-contact-form',
      name: 'Contact Form Submission',
      description: 'High-intent contact form submission',
      rule_type: 'event',
      category: 'behavior',
      conditions: { event_type: 'contact_form_submitted' },
      points: 35,
      max_per_lead: 3
    },
    {
      slug: 'beh-demo-request',
      name: 'Demo Requested',
      description: 'Very high-intent demo request',
      rule_type: 'event',
      category: 'behavior',
      conditions: { event_type: 'demo_requested' },
      points: 50,
      max_per_lead: 1
    },
    {
      slug: 'beh-roi-calculator',
      name: 'ROI Calculator Used',
      description: 'B2B intent signal',
      rule_type: 'event',
      category: 'behavior',
      conditions: { event_type: 'roi_calculator_submitted' },
      points: 30,
      max_per_lead: 3,
      decay_days: 60
    },
    {
      slug: 'beh-sample-download',
      name: 'Sample Report Downloaded',
      description: 'Research intent signal',
      rule_type: 'event',
      category: 'behavior',
      conditions: { event_type: 'sample_report_downloaded' },
      points: 25,
      max_per_lead: 3,
      decay_days: 45
    },
    {
      slug: 'beh-webinar-registered',
      name: 'Webinar Registration',
      description: 'Points for webinar registration',
      rule_type: 'event',
      category: 'behavior',
      conditions: { event_type: 'webinar_registered' },
      points: 20,
      max_per_day: 2,
      decay_days: 30
    },
    {
      slug: 'beh-webinar-attended',
      name: 'Webinar Attended',
      description: 'Higher points for actual attendance',
      rule_type: 'event',
      category: 'behavior',
      conditions: { event_type: 'webinar_attended' },
      points: 35,
      max_per_day: 2,
      decay_days: 45
    }
  ];

  for (const rule of rules) {
    try {
      await db.execute(`
        INSERT INTO scoring_rules (slug, name, description, rule_type, category, conditions, points, max_per_day, max_per_lead, decay_days)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          conditions = EXCLUDED.conditions,
          points = EXCLUDED.points,
          max_per_day = EXCLUDED.max_per_day,
          max_per_lead = EXCLUDED.max_per_lead,
          decay_days = EXCLUDED.decay_days,
          updated_at = NOW()
      `, [
        rule.slug,
        rule.name,
        rule.description,
        rule.rule_type,
        rule.category,
        JSON.stringify(rule.conditions),
        rule.points,
        rule.max_per_day || null,
        rule.max_per_lead || null,
        rule.decay_days || null
      ]);
      console.log(`  ✓ ${rule.slug}`);
    } catch (error) {
      console.error(`  ✗ ${rule.slug}: ${(error as Error).message}`);
    }
  }

  console.log(`Inserted ${rules.length} scoring rules\n`);
}

async function seedTeamMembers() {
  console.log('Seeding team members...');

  const members = [
    { email: 'bdr@dna-me.com', name: 'BDR Team', role: 'bdr', region: 'DACH', max_leads: 50 },
    { email: 'ae@dna-me.com', name: 'Account Executive', role: 'ae', region: 'DACH', max_leads: 30 },
    { email: 'partnerships@dna-me.com', name: 'Partnership Manager', role: 'partnership_manager', region: 'Global', max_leads: 20 },
    { email: 'marketing@dna-me.com', name: 'Marketing Manager', role: 'marketing_manager', region: 'Global', max_leads: 100 }
  ];

  for (const member of members) {
    try {
      await db.execute(`
        INSERT INTO team_members (email, name, role, region, max_leads)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          region = EXCLUDED.region,
          max_leads = EXCLUDED.max_leads
      `, [member.email, member.name, member.role, member.region, member.max_leads]);
      console.log(`  ✓ ${member.email}`);
    } catch (error) {
      console.error(`  ✗ ${member.email}: ${(error as Error).message}`);
    }
  }

  console.log(`Inserted ${members.length} team members\n`);
}

async function main() {
  try {
    // Check database connection
    const healthy = await db.healthCheck();
    if (!healthy) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connected\n');

    // Run seeds
    await seedScoringRules();
    await seedTeamMembers();
    await seedAutomationRules();

    console.log('🌱 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
