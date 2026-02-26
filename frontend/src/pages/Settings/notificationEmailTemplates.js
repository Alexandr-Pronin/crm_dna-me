/**
 * Default email templates per notification event type.
 * Used in Notification Preferences (Settings).
 */

// Deal Stage Change – Pipeline-Stage-Benachrichtigung (z. B. bei Automation „Notification“ auf Stage)
// Mit Pipeline-Flow: abgeschlossene Stages, aktuelle Stage {{stage.name}}, ausstehende Stages
export const DEFAULT_DEAL_STAGE_CHANGE_HTML = `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
<tr><td align="center" style="background-color: #0a0a0f; padding: 20px 0;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%; border-top: 4px solid #00d4aa;">
<tr><td style="background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%); padding: 30px; text-align: center; border-bottom: 2px solid #2d2d44;">
<p style="font-size: 11px; color: #00d4aa; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 8px;">CRM Update</p>
<div style="font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: 3px;">DNA<span style="color: #00d4aa;">-</span>ME</div>
</td></tr>
<tr><td style="background: linear-gradient(135deg, rgba(0,212,170,0.15) 0%, rgba(0,168,132,0.1) 100%); padding: 20px 30px; text-align: center;">
<h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 8px;">Deal fortgeschritten!</h1>
<p style="font-size: 14px; color: #888899; margin: 0;">Eine neue Stage wurde erreicht</p>
</td></tr>
<tr><td style="background-color: #12121a; padding: 35px 30px;">
<div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: 1px solid #2d2d44; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
<div style="display: table; width: 100%; margin-bottom: 20px;">
<div style="display: table-cell; vertical-align: top;">
<h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 8px;">{{deal.name}}</h2>
<p style="font-size: 14px; color: #888899; margin: 0;">{{company.name}}</p>
</div>
<div style="display: table-cell; vertical-align: top; text-align: right; width: 150px;">
<p style="font-size: 28px; font-weight: 700; color: #00d4aa; margin: 0;">{{deal.value}} <span style="font-size: 14px; color: #888899;">{{deal.currency}}</span></p>
</div>
</div>
<div style="height: 1px; background: #2d2d44; margin: 20px 0;"></div>
<div style="margin: 20px 0;">
<p style="font-size: 11px; color: #888899; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">Pipeline: {{pipeline.name}}</p>
<div style="display: table; width: 100%;">
<div style="display: table-cell; text-align: center;">
<div style="width: 32px; height: 32px; background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); border-radius: 50%; margin: 0 auto 8px; font-size: 12px; font-weight: 700; color: #0a0a0f; line-height: 32px;">✓</div>
<p style="font-size: 11px; color: #888899; margin: 0;">Kontakt</p>
</div>
<div style="display: table-cell; text-align: center;">
<div style="width: 32px; height: 32px; background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); border-radius: 50%; margin: 0 auto 8px; font-size: 12px; font-weight: 700; color: #0a0a0f; line-height: 32px;">✓</div>
<p style="font-size: 11px; color: #888899; margin: 0;">Angebot</p>
</div>
<div style="display: table-cell; text-align: center;">
<div style="width: 32px; height: 32px; background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); border-radius: 50%; margin: 0 auto 8px; font-size: 12px; font-weight: 700; color: #0a0a0f; line-height: 32px; box-shadow: 0 0 20px rgba(0,212,170,0.5);">3</div>
<p style="font-size: 11px; color: #00d4aa; font-weight: 600; margin: 0;">{{stage.name}}</p>
</div>
<div style="display: table-cell; text-align: center;">
<div style="width: 32px; height: 32px; background: #2d2d44; border-radius: 50%; margin: 0 auto 8px; font-size: 12px; font-weight: 700; color: #666677; line-height: 32px;">4</div>
<p style="font-size: 11px; color: #888899; margin: 0;">Verhandlung</p>
</div>
<div style="display: table-cell; text-align: center;">
<div style="width: 32px; height: 32px; background: #2d2d44; border-radius: 50%; margin: 0 auto 8px; font-size: 12px; font-weight: 700; color: #666677; line-height: 32px;">5</div>
<p style="font-size: 11px; color: #888899; margin: 0;">Gewonnen</p>
</div>
</div>
</div>
<div style="height: 1px; background: #2d2d44; margin: 20px 0;"></div>
<div style="display: table; width: 100%; margin: 20px 0;">
<div style="display: table-cell; width: 50%; padding: 15px; vertical-align: top;">
<p style="font-size: 11px; color: #888899; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Aktuelles Datum</p>
<p style="font-size: 15px; color: #ffffff; font-weight: 600; margin: 0;">{{deal.date}}</p>
</div>
<div style="display: table-cell; width: 50%; padding: 15px; vertical-align: top;">
<p style="font-size: 11px; color: #888899; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Pipeline</p>
<p style="font-size: 15px; color: #00d4aa; font-weight: 600; margin: 0;">{{pipeline.name}}</p>
</div>
</div>
</div>
</td></tr>
<tr><td style="padding: 25px 30px; background: #0f0f17; text-align: center;">
<a href="{{deal.link}}" style="display: inline-block; background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); color: #0a0a0f; text-decoration: none; padding: 14px 35px; border-radius: 25px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 8px 10px;">Deal öffnen</a>
<a href="https://www.dna-me.net/index.html?lang=de" style="display: inline-block; background: transparent; color: #00d4aa; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; border: 2px solid #00d4aa; margin: 0 8px 10px;">Zum CRM</a>
</td></tr>
<tr><td style="background-color: #0a0a0f; padding: 25px 30px; text-align: center; border-top: 1px solid #2d2d44;">
<p style="font-size: 12px; color: #555566; margin: 0;">DNA-ME CRM System • Automatische Benachrichtigung</p>
</td></tr>
</table>
</td></tr>
</table>
`.trim();

// New Lead – Neuer Lead (Import, unbekannte Absender, Cituro-Webhook)
export const DEFAULT_NEW_LEAD_HTML = `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
<tr><td align="center" style="background-color: #0a0a0f; padding: 20px 0;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%; border-top: 4px solid #f59e0b;">
<tr><td style="background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%); padding: 30px; text-align: center; border-bottom: 2px solid #2d2d44;">
<p style="font-size: 11px; color: #f59e0b; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 8px;">Neuer Lead</p>
<div style="font-size: 28px; font-weight: 700; color: #ffffff;">DNA<span style="color: #00d4aa;">-</span>ME</div>
</td></tr>
<tr><td style="background: linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.1) 100%); padding: 20px 30px; text-align: center;">
<h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 8px;">Neuer Lead eingegangen!</h1>
<p style="font-size: 14px; color: #888899; margin: 0;">Schnelle Reaktion empfohlen</p>
</td></tr>
<tr><td style="background-color: #12121a; padding: 35px 30px;">
<div style="background: linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.05) 100%); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 25px; text-align: center;">
<h2 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 8px;">{{lead.name}}</h2>
<p style="font-size: 14px; color: #f59e0b; margin: 0 0 20px;">{{lead.email}}</p>
<p style="font-size: 11px; color: #888899; margin-bottom: 6px;">Eingegangen am</p>
<p style="font-size: 15px; color: #ffffff; font-weight: 600; margin: 0;">{{deal.date}}</p>
</div>
<p style="font-size: 14px; color: #a0a0b0; margin: 20px 0 0;">Dieser Lead wartet auf Ihre Antwort. Durchschnittliche Reaktionszeit: unter 2 Stunden für beste Conversion-Rate.</p>
</td></tr>
<tr><td style="padding: 25px 30px; background: #0f0f17; text-align: center;">
<a href="mailto:{{lead.email}}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #0a0a0f; text-decoration: none; padding: 14px 35px; border-radius: 25px; font-size: 14px; font-weight: 700;">Email senden</a>
<a href="{{deal.link}}" style="display: inline-block; border: 2px solid #00d4aa; color: #00d4aa; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-size: 13px; font-weight: 600; margin-left: 8px;">Im CRM ansehen</a>
</td></tr>
<tr><td style="background-color: #0a0a0f; padding: 25px 30px; text-align: center; border-top: 1px solid #2d2d44;">
<p style="font-size: 12px; color: #555566; margin: 0;">DNA-ME Lead Management • Automatische Benachrichtigung</p>
</td></tr>
</table>
</td></tr>
</table>
`.trim();

// Weekly Report – Pipeline-Übersicht (wöchentlicher Report)
export const DEFAULT_WEEKLY_REPORT_HTML = `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
<tr><td align="center" style="background-color: #0a0a0f; padding: 20px 0;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%; border-top: 4px solid #8b5cf6;">
<tr><td style="background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%); padding: 30px; text-align: center; border-bottom: 2px solid #2d2d44;">
<p style="font-size: 11px; color: #8b5cf6; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 8px;">Täglicher Report</p>
<div style="font-size: 28px; font-weight: 700; color: #ffffff;">DNA<span style="color: #00d4aa;">-</span>ME</div>
</td></tr>
<tr><td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px 30px; text-align: center;">
<h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 8px;">Pipeline Übersicht</h1>
<p style="font-size: 14px; color: #888899; margin: 0;">{{deal.date}}</p>
</td></tr>
<tr><td style="background-color: #12121a; padding: 35px 30px;">
<div style="background: #1a1a2e; border-radius: 10px; padding: 25px; text-align: center; margin-bottom: 25px;">
<p style="font-size: 14px; color: #888899; margin-bottom: 15px;">Gesamtumsatz (gewonnene Deals)</p>
<p style="font-size: 42px; font-weight: 700; color: #00d4aa; margin: 0;">{{stats.revenue_won}} <span style="font-size: 18px; color: #888899;">EUR</span></p>
</div>
<div style="display: table; width: 100%;">
<div style="display: table-cell; width: 33.33%; padding: 20px 10px; text-align: center; border-right: 1px solid #2d2d44;">
<p style="font-size: 32px; font-weight: 700; color: #00d4aa; margin: 0 0 5px;">{{stats.won_deals}}</p>
<p style="font-size: 12px; color: #888899; margin: 0;">Gewonnen</p>
</div>
<div style="display: table-cell; width: 33.33%; padding: 20px 10px; text-align: center; border-right: 1px solid #2d2d44;">
<p style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 0 0 5px;">{{stats.open_deals}}</p>
<p style="font-size: 12px; color: #888899; margin: 0;">Offen</p>
</div>
<div style="display: table-cell; width: 33.33%; padding: 20px 10px; text-align: center;">
<p style="font-size: 32px; font-weight: 700; color: #f59e0b; margin: 0 0 5px;">{{stats.lost_deals}}</p>
<p style="font-size: 12px; color: #888899; margin: 0;">Verloren</p>
</div>
</div>
<div style="height: 1px; background: #2d2d44; margin: 25px 0;"></div>
<div style="display: table; width: 100%;">
<div style="display: table-cell; width: 33.33%; padding: 20px 10px; text-align: center; border-right: 1px solid #2d2d44;">
<p style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 0 0 5px;">{{stats.leads}}</p>
<p style="font-size: 12px; color: #888899; margin: 0;">Neue Leads</p>
</div>
<div style="display: table-cell; width: 33.33%; padding: 20px 10px; text-align: center; border-right: 1px solid #2d2d44;">
<p style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 0 0 5px;">{{stats.customers}}</p>
<p style="font-size: 12px; color: #888899; margin: 0;">Kunden</p>
</div>
<div style="display: table-cell; width: 33.33%; padding: 20px 10px; text-align: center;">
<p style="font-size: 32px; font-weight: 700; color: #8b5cf6; margin: 0 0 5px;">{{stats.avg_deal}}€</p>
<p style="font-size: 12px; color: #888899; margin: 0;">Ø Deal-Größe</p>
</div>
</div>
</td></tr>
<tr><td style="padding: 25px 30px; background: #0f0f17; text-align: center;">
<a href="https://www.dna-me.net/index.html?lang=de" style="display: inline-block; background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); color: #0a0a0f; text-decoration: none; padding: 14px 35px; border-radius: 25px; font-size: 14px; font-weight: 700;">Vollständiger Report</a>
</td></tr>
<tr><td style="background-color: #0a0a0f; padding: 25px 30px; text-align: center; border-top: 1px solid #2d2d44;">
<p style="font-size: 12px; color: #555566; margin: 0;">DNA-ME Analytics • Täglicher Report</p>
</td></tr>
</table>
</td></tr>
</table>
`.trim();

export const EVENT_TYPE_IDS = {
  DEAL_STAGE_CHANGE: 'deal_stage_change',
  NEW_LEAD: 'new_lead',
  WEEKLY_REPORT: 'weekly_report',
};

export const EVENT_TYPE_LABELS = {
  [EVENT_TYPE_IDS.DEAL_STAGE_CHANGE]: 'Deal-Stage geändert (Pipeline-Benachrichtigung)',
  [EVENT_TYPE_IDS.NEW_LEAD]: 'Neuer Lead eingegangen',
  [EVENT_TYPE_IDS.WEEKLY_REPORT]: 'Pipeline-Übersicht (wöchentlich)',
};

export const DEFAULT_SUBJECTS = {
  [EVENT_TYPE_IDS.DEAL_STAGE_CHANGE]: 'Deal fortgeschritten: {{deal.name}} – {{stage.name}}',
  [EVENT_TYPE_IDS.NEW_LEAD]: 'Neuer Lead: {{lead.name}}',
  [EVENT_TYPE_IDS.WEEKLY_REPORT]: 'Pipeline-Übersicht – {{deal.date}}',
};

export const DEFAULT_HTML = {
  [EVENT_TYPE_IDS.DEAL_STAGE_CHANGE]: DEFAULT_DEAL_STAGE_CHANGE_HTML,
  [EVENT_TYPE_IDS.NEW_LEAD]: DEFAULT_NEW_LEAD_HTML,
  [EVENT_TYPE_IDS.WEEKLY_REPORT]: DEFAULT_WEEKLY_REPORT_HTML,
};
