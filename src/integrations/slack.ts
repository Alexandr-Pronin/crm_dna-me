// =============================================================================
// src/integrations/slack.ts
// Slack Integration Service for Notifications
// =============================================================================

import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';

// =============================================================================
// Types
// =============================================================================

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text?: { type: string; text: string };
    url?: string;
    style?: string;
    action_id?: string;
    value?: string;
  }>;
}

interface HotLeadData {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  total_score: number;
  primary_intent?: string | null;
  intent_confidence: number;
}

interface RoutingConflictData {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  total_score: number;
  intent_summary: {
    research: number;
    b2b: number;
    co_creation: number;
  };
}

interface DailyDigestStats {
  new_leads: number;
  hot_leads: number;
  deals_created: number;
  deals_won: number;
  total_value: number;
  top_sources: Array<{ source: string; count: number }>;
}

// =============================================================================
// Slack Service
// =============================================================================

export class SlackService {
  private webhookUrl: string | null;
  private botToken: string | null;
  private enabled: boolean;
  private httpClient: AxiosInstance;
  private baseUrl: string;

  constructor(webhookUrl?: string | null, botToken?: string | null) {
    this.webhookUrl = webhookUrl || null;
    this.botToken = botToken || null;
    this.enabled = config.slack.enabled && !!this.webhookUrl;
    this.baseUrl = process.env.CRM_BASE_URL || 'https://crm.dna-me.com';

    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Check if Slack is configured and enabled
   */
  isConfigured(): boolean {
    return this.enabled && !!this.webhookUrl;
  }

  /**
   * Send a simple text message via webhook
   */
  async sendMessage(channel: string, text: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log('[Slack] Not configured, skipping message:', text.substring(0, 50));
      return false;
    }

    try {
      await this.httpClient.post(this.webhookUrl!, {
        channel,
        text,
        unfurl_links: false
      });
      return true;
    } catch (error) {
      console.error('[Slack] Failed to send message:', error);
      return false;
    }
  }

  /**
   * Send a rich message with blocks
   */
  async sendRichMessage(channel: string, blocks: SlackBlock[], fallbackText?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log('[Slack] Not configured, skipping rich message');
      return false;
    }

    try {
      await this.httpClient.post(this.webhookUrl!, {
        channel,
        text: fallbackText || 'New notification',
        blocks
      });
      return true;
    } catch (error) {
      console.error('[Slack] Failed to send rich message:', error);
      return false;
    }
  }

  /**
   * Send hot lead alert
   */
  async sendHotLeadAlert(lead: HotLeadData): Promise<boolean> {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown';
    
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔥 New Hot Lead!',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Name:*\n${name}`
          },
          {
            type: 'mrkdwn',
            text: `*Score:*\n${lead.total_score} points`
          },
          {
            type: 'mrkdwn',
            text: `*Email:*\n${lead.email}`
          },
          {
            type: 'mrkdwn',
            text: `*Intent:*\n${lead.primary_intent || 'Unknown'} (${lead.intent_confidence}%)`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Title:* ${lead.job_title || 'N/A'}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '👤 View Lead' },
            url: `${this.baseUrl}/leads/${lead.id}`,
            style: 'primary'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '📞 Contact Now' },
            action_id: `contact_lead_${lead.id}`
          }
        ]
      }
    ];

    return this.sendRichMessage('#hot-leads', blocks, `Hot Lead: ${lead.email} (Score: ${lead.total_score})`);
  }

  /**
   * Send routing conflict notification
   */
  async sendRoutingConflict(lead: RoutingConflictData): Promise<boolean> {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown';
    const { intent_summary } = lead;

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Routing Decision Required',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Lead *${name}* (${lead.email}) has ambiguous intent.\n\n` +
                `*Intent Signals:*\n` +
                `• 🔬 Research: ${intent_summary.research} pts\n` +
                `• 🏢 B2B: ${intent_summary.b2b} pts\n` +
                `• 🤝 Co-Creation: ${intent_summary.co_creation} pts`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '🔬 Research' },
            action_id: `route_${lead.id}_research`,
            value: 'research'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🏢 B2B' },
            action_id: `route_${lead.id}_b2b`,
            value: 'b2b'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🤝 Co-Creation' },
            action_id: `route_${lead.id}_cocreation`,
            value: 'co_creation'
          }
        ]
      }
    ];

    return this.sendRichMessage('#lead-routing', blocks, `Routing needed: ${lead.email}`);
  }

  /**
   * Send daily digest
   */
  async sendDailyDigest(stats: DailyDigestStats): Promise<boolean> {
    const topSourcesText = stats.top_sources.length > 0
      ? stats.top_sources.map((s, i) => `${i + 1}. ${s.source}: ${s.count}`).join('\n')
      : 'No data yet';

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Daily Marketing Digest',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*New Leads:*\n${stats.new_leads}` },
          { type: 'mrkdwn', text: `*Hot Leads:*\n${stats.hot_leads}` },
          { type: 'mrkdwn', text: `*Deals Created:*\n${stats.deals_created}` },
          { type: 'mrkdwn', text: `*Deals Won:*\n${stats.deals_won}` }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Total Pipeline Value:* €${stats.total_value.toLocaleString('de-DE')}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Lead Sources:*\n${topSourcesText}`
        }
      }
    ];

    return this.sendRichMessage('#marketing-daily', blocks, 'Daily Marketing Digest');
  }

  /**
   * Send deal won notification
   */
  async sendDealWonAlert(deal: {
    id: string;
    name: string;
    value: number;
    assigned_to?: string | null;
    lead_email: string;
  }): Promise<boolean> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎉 Deal Won!',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Deal:*\n${deal.name}` },
          { type: 'mrkdwn', text: `*Value:*\n€${deal.value.toLocaleString('de-DE')}` },
          { type: 'mrkdwn', text: `*Customer:*\n${deal.lead_email}` },
          { type: 'mrkdwn', text: `*Closed by:*\n${deal.assigned_to || 'Unassigned'}` }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '📋 View Deal' },
            url: `${this.baseUrl}/deals/${deal.id}`,
            style: 'primary'
          }
        ]
      }
    ];

    return this.sendRichMessage('#sales-wins', blocks, `Deal Won: ${deal.name} - €${deal.value}`);
  }

  /**
   * Send task reminder notification
   */
  async sendTaskReminder(task: {
    id: string;
    title: string;
    assigned_to?: string | null;
    due_date: string;
    lead_email?: string;
  }): Promise<boolean> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⏰ Task Reminder',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Task:* ${task.title}\n` +
                `*Due:* ${new Date(task.due_date).toLocaleDateString('de-DE')}\n` +
                `*Assigned to:* ${task.assigned_to || 'Unassigned'}\n` +
                (task.lead_email ? `*Lead:* ${task.lead_email}` : '')
        }
      }
    ];

    return this.sendRichMessage('#task-reminders', blocks, `Task Reminder: ${task.title}`);
  }

  /**
   * Send error alert to ops channel
   */
  async sendErrorAlert(error: {
    message: string;
    context?: string;
    stack?: string;
  }): Promise<boolean> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 System Error',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:* ${error.message}\n` +
                (error.context ? `*Context:* ${error.context}\n` : '') +
                (error.stack ? `\`\`\`${error.stack.substring(0, 500)}\`\`\`` : '')
        }
      }
    ];

    return this.sendRichMessage('#crm-alerts', blocks, `System Error: ${error.message}`);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let slackServiceInstance: SlackService | null = null;

export function getSlackService(): SlackService {
  if (!slackServiceInstance) {
    slackServiceInstance = new SlackService(
      config.slack.webhookUrl,
      config.slack.botToken
    );
  }
  return slackServiceInstance;
}

export default SlackService;
