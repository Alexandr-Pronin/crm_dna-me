/**
 * E-Mail-Marketing-Layout im DNA-ME-Stil (wie Notification-Mails).
 * Wrappt den Schritt-Body (body_html) in Header, Content-Bereich und Footer.
 */

const EMAIL_LAYOUT_START = `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
<tr><td align="center" style="background-color: #0a0a0f; padding: 20px 0;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%; border-top: 4px solid #00d4aa;">
<tr><td style="background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%); padding: 30px; text-align: center; border-bottom: 2px solid #2d2d44;">
<p style="font-size: 11px; color: #00d4aa; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 8px;">E-Mail Marketing</p>
<div style="font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: 3px;">DNA<span style="color: #00d4aa;">-</span>ME</div>
</td></tr>
<tr><td style="background-color: #12121a; padding: 35px 30px;">
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; line-height: 1.6; color: #e0e0e8;">
`.trim();

const EMAIL_LAYOUT_END = `
</div>
</td></tr>
<tr><td style="background-color: #0a0a0f; padding: 25px 30px; text-align: center; border-top: 1px solid #2d2d44;">
<p style="font-size: 12px; color: #555566; margin: 0;">DNA-ME • E-Mail Marketing</p>
</td></tr>
</table>
</td></tr>
</table>
`.trim();

/**
 * Fügt um den rohen body_html ein DNA-ME-Layout (Header, Content-Box, Footer).
 * Der übergebene HTML wird unverändert in den Content-Bereich eingefügt.
 * Die äußere Hülle setzt Schrift und Farbe (Dark-Theme), Inhalte mit <p>, <ul>, <a> etc. erben wo möglich.
 */
export function wrapEmailMarketingBody(bodyHtml: string): string {
  return EMAIL_LAYOUT_START + bodyHtml + EMAIL_LAYOUT_END;
}
