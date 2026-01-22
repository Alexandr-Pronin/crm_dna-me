// =============================================================================
// src/db/seeds/automationRules.ts
// Seed Default Automation Rules
// =============================================================================

import { db } from '../index.js';

interface AutomationRuleSeed {
  name: string;
  description: string;
  is_active: boolean;
  priority: number;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
}

// =============================================================================
// Default Automation Rules
// =============================================================================

const DEFAULT_AUTOMATION_RULES: AutomationRuleSeed[] = [
  // ---------------------------------------------------------------------------
  // Hot Lead Alert
  // ---------------------------------------------------------------------------
  {
    name: 'Hot Lead Alert',
    description: 'Send Slack notification when lead score reaches 80+',
    is_active: true,
    priority: 1,
    trigger_type: 'score_threshold',
    trigger_config: {
      score_gte: 80
    },
    action_type: 'send_notification',
    action_config: {
      channel: '#hot-leads',
      template: '🔥 Hot Lead Alert: {lead.first_name} {lead.last_name} ({lead.email}) scored {lead.score} points!'
    }
  },
  
  // ---------------------------------------------------------------------------
  // Demo Requested - Create Follow-up Task
  // ---------------------------------------------------------------------------
  {
    name: 'Demo Requested Follow-up',
    description: 'Create task to book demo call when demo is requested',
    is_active: true,
    priority: 2,
    trigger_type: 'event',
    trigger_config: {
      event_type: 'demo_requested'
    },
    action_type: 'create_task',
    action_config: {
      title: 'Book demo call with {lead.first_name} {lead.last_name}',
      task_type: 'demo_call',
      due_days: 1
    }
  },
  
  // ---------------------------------------------------------------------------
  // Order Placed - Update Lifecycle Stage
  // ---------------------------------------------------------------------------
  {
    name: 'Order Placed - Update to Customer',
    description: 'Update lifecycle stage to customer when order is placed',
    is_active: true,
    priority: 3,
    trigger_type: 'event',
    trigger_config: {
      event_type: 'order_placed'
    },
    action_type: 'update_field',
    action_config: {
      field: 'lifecycle_stage',
      value: 'customer'
    }
  },
  
  // ---------------------------------------------------------------------------
  // User Registration - Welcome Task
  // ---------------------------------------------------------------------------
  {
    name: 'User Registration Welcome',
    description: 'Create welcome follow-up task for new user registrations',
    is_active: true,
    priority: 4,
    trigger_type: 'event',
    trigger_config: {
      event_type: 'user_registered'
    },
    action_type: 'create_task',
    action_config: {
      title: 'Welcome call to {lead.first_name} {lead.last_name}',
      task_type: 'welcome_call',
      due_days: 2
    }
  },
  
  // ---------------------------------------------------------------------------
  // Pricing Page Visit - Notify Sales
  // ---------------------------------------------------------------------------
  {
    name: 'Pricing Page High Intent',
    description: 'Notify sales when lead visits pricing page',
    is_active: true,
    priority: 5,
    trigger_type: 'event',
    trigger_config: {
      event_type: 'page_visited',
      metadata: {
        page_path: '/pricing'
      }
    },
    action_type: 'send_notification',
    action_config: {
      channel: '#sales-alerts',
      template: '💰 {lead.email} is checking pricing page - potential buyer!'
    }
  },
  
  // ---------------------------------------------------------------------------
  // Research Intent Detected - Route to Research Pipeline
  // ---------------------------------------------------------------------------
  {
    name: 'Research Intent Routing',
    description: 'Route lead to Research Lab when research intent is detected with high confidence',
    is_active: true,
    priority: 10,
    trigger_type: 'intent_detected',
    trigger_config: {
      intent: 'research',
      confidence_gte: 70
    },
    action_type: 'route_to_pipeline',
    action_config: {
      pipeline_slug: 'research-lab',
      create_deal: true
    }
  },
  
  // ---------------------------------------------------------------------------
  // B2B Intent Detected - Route to B2B Pipeline
  // ---------------------------------------------------------------------------
  {
    name: 'B2B Intent Routing',
    description: 'Route lead to B2B Lab when B2B intent is detected with high confidence',
    is_active: true,
    priority: 11,
    trigger_type: 'intent_detected',
    trigger_config: {
      intent: 'b2b',
      confidence_gte: 70
    },
    action_type: 'route_to_pipeline',
    action_config: {
      pipeline_slug: 'b2b-lab',
      create_deal: true
    }
  },
  
  // ---------------------------------------------------------------------------
  // Co-Creation Intent Detected - Route to Co-Creation Pipeline
  // ---------------------------------------------------------------------------
  {
    name: 'Co-Creation Intent Routing',
    description: 'Route lead to Co-Creation when co-creation intent is detected',
    is_active: true,
    priority: 12,
    trigger_type: 'intent_detected',
    trigger_config: {
      intent: 'co_creation',
      confidence_gte: 60
    },
    action_type: 'route_to_pipeline',
    action_config: {
      pipeline_slug: 'co-creation',
      create_deal: true
    }
  },
  
  // ---------------------------------------------------------------------------
  // ROI Calculator Submitted - High Intent Alert
  // ---------------------------------------------------------------------------
  {
    name: 'ROI Calculator Engagement',
    description: 'Create urgent task when lead uses ROI calculator',
    is_active: true,
    priority: 6,
    trigger_type: 'event',
    trigger_config: {
      event_type: 'roi_calculator_submitted'
    },
    action_type: 'create_task',
    action_config: {
      title: 'High intent: {lead.first_name} used ROI calculator',
      task_type: 'follow_up',
      due_days: 1
    }
  },
  
  // ---------------------------------------------------------------------------
  // Contact Form Submission
  // ---------------------------------------------------------------------------
  {
    name: 'Contact Form Follow-up',
    description: 'Create task when contact form is submitted',
    is_active: true,
    priority: 7,
    trigger_type: 'event',
    trigger_config: {
      event_type: 'form_submitted',
      metadata: {
        form_type: 'contact'
      }
    },
    action_type: 'create_task',
    action_config: {
      title: 'Respond to contact form from {lead.first_name} {lead.last_name}',
      task_type: 'contact_response',
      due_days: 1
    }
  },
  
  // ---------------------------------------------------------------------------
  // MQL Threshold - Notify Marketing
  // ---------------------------------------------------------------------------
  {
    name: 'MQL Achieved Notification',
    description: 'Notify marketing when lead reaches MQL score (40+)',
    is_active: true,
    priority: 8,
    trigger_type: 'score_threshold',
    trigger_config: {
      score_gte: 40
    },
    action_type: 'send_notification',
    action_config: {
      channel: '#marketing-mql',
      template: '📈 New MQL: {lead.first_name} {lead.last_name} ({lead.email}) - Score: {lead.score}'
    }
  }
];

// =============================================================================
// Seed Function
// =============================================================================

export async function seedAutomationRules(): Promise<void> {
  console.log('Seeding automation rules...');
  
  for (const rule of DEFAULT_AUTOMATION_RULES) {
    try {
      // Check if rule already exists
      const existing = await db.queryOne<{ id: string }>(
        'SELECT id FROM automation_rules WHERE name = $1',
        [rule.name]
      );
      
      if (existing) {
        // Update existing rule
        await db.execute(`
          UPDATE automation_rules SET
            description = $1,
            is_active = $2,
            priority = $3,
            trigger_type = $4,
            trigger_config = $5,
            action_type = $6,
            action_config = $7,
            updated_at = NOW()
          WHERE id = $8
        `, [
          rule.description,
          rule.is_active,
          rule.priority,
          rule.trigger_type,
          JSON.stringify(rule.trigger_config),
          rule.action_type,
          JSON.stringify(rule.action_config),
          existing.id
        ]);
        console.log(`  ✓ Updated: ${rule.name}`);
      } else {
        // Insert new rule
        await db.execute(`
          INSERT INTO automation_rules (
            name, description, is_active, priority,
            trigger_type, trigger_config, action_type, action_config,
            execution_count, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            0, NOW(), NOW()
          )
        `, [
          rule.name,
          rule.description,
          rule.is_active,
          rule.priority,
          rule.trigger_type,
          JSON.stringify(rule.trigger_config),
          rule.action_type,
          JSON.stringify(rule.action_config)
        ]);
        console.log(`  ✓ Created: ${rule.name}`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to seed rule "${rule.name}":`, error);
    }
  }
  
  // Get final count
  const countResult = await db.queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM automation_rules'
  );
  const count = parseInt(countResult?.count || '0', 10);
  
  console.log(`\n✅ Automation rules seeded successfully (${count} total rules)`);
}

// =============================================================================
// Run if executed directly
// =============================================================================

const isMainModule = process.argv[1]?.endsWith('automationRules.ts') || 
                     process.argv[1]?.endsWith('automationRules.js');

if (isMainModule) {
  seedAutomationRules()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to seed automation rules:', error);
      process.exit(1);
    });
}

export default seedAutomationRules;
