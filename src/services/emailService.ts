// =============================================================================
// src/services/emailService.ts
// E-Mail Service für SMTP-Versand mit Tracking (Opens & Clicks)
// =============================================================================

import nodemailer, { Transporter } from 'nodemailer';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import { db } from '../db/index.js';

// =============================================================================
// Types
// =============================================================================

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  trackingId?: string;
  error?: string;
}

export interface TrackingOptions {
  enrollmentId: string;
  stepId: string;
  enableOpenTracking?: boolean;
  enableClickTracking?: boolean;
}

export interface EmailTrackingRecord {
  id: string;
  enrollment_id: string;
  step_id: string;
  sent_at: Date;
  opened_at?: Date;
  open_count: number;
  clicked_at?: Date;
  click_count: number;
  bounced_at?: Date;
  bounce_reason?: string;
  unsubscribed_at?: Date;
  metadata: Record<string, unknown>;
}

// =============================================================================
// E-Mail Service Class
// =============================================================================

export class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;
  private trackingBaseUrl: string;

  constructor() {
    this.trackingBaseUrl = process.env.TRACKING_BASE_URL || 
                           process.env.APP_URL || 
                           'http://localhost:3000';
    this.initializeTransporter();
  }

  // ===========================================================================
  // Initialize SMTP Transporter
  // ===========================================================================

  private initializeTransporter(): void {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('⚠️ EmailService: SMTP-Konfiguration unvollständig. E-Mail-Versand deaktiviert.');
      this.isConfigured = false;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      // Für Entwicklung: weniger strenge TLS-Prüfung
      ...(process.env.NODE_ENV === 'development' && {
        tls: {
          rejectUnauthorized: false
        }
      })
    });

    this.isConfigured = true;
    console.log(`[EmailService] SMTP konfiguriert: ${smtpHost}:${smtpPort}`);
  }

  // ===========================================================================
  // Check Configuration
  // ===========================================================================

  checkConfiguration(): boolean {
    return this.isConfigured;
  }

  // ===========================================================================
  // Test Connection
  // ===========================================================================

  async testConnection(): Promise<{ connected: boolean; error?: string }> {
    if (!this.isConfigured || !this.transporter) {
      return { connected: false, error: 'SMTP nicht konfiguriert' };
    }

    try {
      await this.transporter.verify();
      return { connected: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
      return { connected: false, error: message };
    }
  }

  // ===========================================================================
  // Send Email
  // ===========================================================================

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    if (!this.isConfigured || !this.transporter) {
      console.warn('[EmailService] E-Mail-Versand übersprungen: SMTP nicht konfiguriert');
      return {
        success: false,
        error: 'SMTP nicht konfiguriert'
      };
    }

    const fromEmail = options.from || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@dna-me.com';
    const fromName = options.fromName || process.env.SMTP_FROM_NAME || 'DNA ME';
    const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    try {
      const mailOptions = {
        from: fromAddress,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        attachments: options.attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`[EmailService] E-Mail gesendet: ${options.subject} → ${options.to} (Message-ID: ${info.messageId})`);
      
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error(`[EmailService] Fehler beim Versenden: ${errorMessage}`, error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // ===========================================================================
  // Send Email with Template Variables
  // ===========================================================================

  async sendTemplatedEmail(
    options: EmailOptions,
    variables: Record<string, string | number>
  ): Promise<EmailResult> {
    // Einfache Template-Variablen-Ersetzung
    const replaceVariables = (text: string): string => {
      let result = text;
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, String(value));
      }
      return result;
    };

    const templatedOptions: EmailOptions = {
      ...options,
      subject: replaceVariables(options.subject),
      html: options.html ? replaceVariables(options.html) : undefined,
      text: options.text ? replaceVariables(options.text) : undefined
    };

    return this.sendEmail(templatedOptions);
  }

  // ===========================================================================
  // Send Email with Tracking (for Sequences)
  // ===========================================================================

  /**
   * Sendet eine E-Mail mit Open- und Click-Tracking für E-Mail-Sequenzen
   */
  async sendTrackedEmail(
    options: EmailOptions,
    tracking: TrackingOptions
  ): Promise<EmailResult> {
    if (!this.isConfigured || !this.transporter) {
      console.warn('[EmailService] E-Mail-Versand übersprungen: SMTP nicht konfiguriert');
      return {
        success: false,
        error: 'SMTP nicht konfiguriert'
      };
    }

    // Erstelle Tracking-Record in der Datenbank
    const trackingId = randomUUID();
    
    try {
      await db.execute(
        `INSERT INTO email_tracking (id, enrollment_id, step_id, sent_at)
         VALUES ($1, $2, $3, NOW())`,
        [trackingId, tracking.enrollmentId, tracking.stepId]
      );
    } catch (error) {
      console.error('[EmailService] Fehler beim Erstellen des Tracking-Records:', error);
    }

    // Prepare HTML with tracking
    let trackedHtml = options.html || '';

    // Add Open Tracking Pixel
    if (tracking.enableOpenTracking !== false && trackedHtml) {
      trackedHtml = this.injectTrackingPixel(trackedHtml, trackingId);
    }

    // Wrap links for Click Tracking
    if (tracking.enableClickTracking !== false && trackedHtml) {
      trackedHtml = this.wrapLinksForTracking(trackedHtml, trackingId);
    }

    // Add unsubscribe link if not present
    if (trackedHtml && !trackedHtml.includes('unsubscribe')) {
      trackedHtml = this.addUnsubscribeLink(trackedHtml, tracking.enrollmentId);
    }

    const fromEmail = options.from || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@dna-me.com';
    const fromName = options.fromName || process.env.SMTP_FROM_NAME || 'DNA ME';
    const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    try {
      const mailOptions = {
        from: fromAddress,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: trackedHtml || undefined,
        replyTo: options.replyTo,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        attachments: options.attachments,
        headers: {
          'X-DNA-Tracking-ID': trackingId,
          'List-Unsubscribe': `<${this.trackingBaseUrl}/api/v1/email/unsubscribe/${tracking.enrollmentId}>`
        }
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`[EmailService] Tracked E-Mail gesendet: ${options.subject} → ${options.to} (Tracking-ID: ${trackingId})`);
      
      return {
        success: true,
        messageId: info.messageId,
        trackingId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error(`[EmailService] Fehler beim Versenden: ${errorMessage}`, error);
      
      // Update tracking record with error
      try {
        await db.execute(
          `UPDATE email_tracking 
           SET bounced_at = NOW(), bounce_reason = $1
           WHERE id = $2`,
          [errorMessage, trackingId]
        );
      } catch {
        // Ignore tracking update errors
      }
      
      return {
        success: false,
        trackingId,
        error: errorMessage
      };
    }
  }

  // ===========================================================================
  // Tracking Pixel Generation
  // ===========================================================================

  /**
   * Generiert die URL für das Tracking-Pixel
   */
  generateTrackingPixelUrl(trackingId: string): string {
    return `${this.trackingBaseUrl}/api/v1/email/track/open/${trackingId}.gif`;
  }

  /**
   * Generiert ein 1x1 Tracking-Pixel als HTML <img>-Tag
   */
  generateTrackingPixelHtml(trackingId: string): string {
    const pixelUrl = this.generateTrackingPixelUrl(trackingId);
    return `<img src="${pixelUrl}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />`;
  }

  /**
   * Fügt ein Tracking-Pixel in den HTML-Body ein (vor </body>)
   */
  private injectTrackingPixel(html: string, trackingId: string): string {
    const pixel = this.generateTrackingPixelHtml(trackingId);
    
    // Try to insert before </body>
    if (html.includes('</body>')) {
      return html.replace('</body>', `${pixel}</body>`);
    }
    
    // Otherwise append at the end
    return html + pixel;
  }

  // ===========================================================================
  // Link Tracking
  // ===========================================================================

  /**
   * Generiert eine Tracking-URL für einen Link
   */
  generateTrackingLinkUrl(trackingId: string, originalUrl: string): string {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${this.trackingBaseUrl}/api/v1/email/track/click/${trackingId}?url=${encodedUrl}`;
  }

  /**
   * Ersetzt alle Links im HTML mit Tracking-Links
   */
  private wrapLinksForTracking(html: string, trackingId: string): string {
    // Match href="..." or href='...'
    const linkRegex = /href=["']([^"']+)["']/gi;
    
    return html.replace(linkRegex, (match, url: string) => {
      // Skip tracking for certain URLs
      if (this.shouldSkipLinkTracking(url)) {
        return match;
      }
      
      const trackedUrl = this.generateTrackingLinkUrl(trackingId, url);
      return `href="${trackedUrl}"`;
    });
  }

  /**
   * Prüft ob ein Link vom Tracking ausgenommen werden soll
   */
  private shouldSkipLinkTracking(url: string): boolean {
    // Skip mailto: links
    if (url.startsWith('mailto:')) return true;
    
    // Skip tel: links
    if (url.startsWith('tel:')) return true;
    
    // Skip anchor links
    if (url.startsWith('#')) return true;
    
    // Skip unsubscribe links (already handled)
    if (url.includes('unsubscribe')) return true;
    
    // Skip tracking pixel URLs
    if (url.includes('/track/')) return true;
    
    return false;
  }

  // ===========================================================================
  // Unsubscribe Link
  // ===========================================================================

  /**
   * Fügt einen Unsubscribe-Link am Ende der E-Mail hinzu
   */
  private addUnsubscribeLink(html: string, enrollmentId: string): string {
    const unsubscribeUrl = `${this.trackingBaseUrl}/api/v1/email/unsubscribe/${enrollmentId}`;
    const unsubscribeHtml = `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #888; font-size: 12px;">
        <p>Diese E-Mail wurde Ihnen von DNA ME gesendet.</p>
        <p><a href="${unsubscribeUrl}" style="color: #888;">Von dieser E-Mail-Liste abmelden</a></p>
      </div>
    `;
    
    if (html.includes('</body>')) {
      return html.replace('</body>', `${unsubscribeHtml}</body>`);
    }
    
    return html + unsubscribeHtml;
  }

  // ===========================================================================
  // Record Tracking Events
  // ===========================================================================

  /**
   * Zeichnet einen E-Mail-Open auf
   */
  async recordOpen(trackingId: string): Promise<boolean> {
    try {
      const result = await db.execute(
        `UPDATE email_tracking 
         SET opened_at = COALESCE(opened_at, NOW()),
             open_count = open_count + 1
         WHERE id = $1`,
        [trackingId]
      );
      
      if (result > 0) {
        console.log(`[EmailService] Open recorded: ${trackingId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[EmailService] Fehler beim Aufzeichnen des Opens:', error);
      return false;
    }
  }

  /**
   * Zeichnet einen Link-Klick auf
   */
  async recordClick(trackingId: string, clickedUrl?: string): Promise<boolean> {
    try {
      const metadata = clickedUrl ? { last_clicked_url: clickedUrl } : {};
      
      const result = await db.execute(
        `UPDATE email_tracking 
         SET clicked_at = COALESCE(clicked_at, NOW()),
             click_count = click_count + 1,
             metadata = metadata || $1::jsonb
         WHERE id = $2`,
        [JSON.stringify(metadata), trackingId]
      );
      
      if (result > 0) {
        console.log(`[EmailService] Click recorded: ${trackingId}${clickedUrl ? ` → ${clickedUrl}` : ''}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[EmailService] Fehler beim Aufzeichnen des Clicks:', error);
      return false;
    }
  }

  /**
   * Zeichnet eine Abmeldung auf
   */
  async recordUnsubscribe(enrollmentId: string): Promise<boolean> {
    try {
      // Update the tracking record
      await db.execute(
        `UPDATE email_tracking 
         SET unsubscribed_at = NOW()
         WHERE enrollment_id = $1 AND unsubscribed_at IS NULL`,
        [enrollmentId]
      );
      
      // Update the enrollment status
      const result = await db.execute(
        `UPDATE email_sequence_enrollments 
         SET status = 'unsubscribed',
             unsubscribed_at = NOW()
         WHERE id = $1 AND status != 'unsubscribed'`,
        [enrollmentId]
      );
      
      if (result > 0) {
        console.log(`[EmailService] Unsubscribe recorded: ${enrollmentId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[EmailService] Fehler beim Aufzeichnen der Abmeldung:', error);
      return false;
    }
  }

  // ===========================================================================
  // Get Tracking Statistics
  // ===========================================================================

  /**
   * Holt Tracking-Statistiken für eine E-Mail
   */
  async getTrackingStats(trackingId: string): Promise<EmailTrackingRecord | null> {
    return db.queryOne<EmailTrackingRecord>(
      `SELECT * FROM email_tracking WHERE id = $1`,
      [trackingId]
    );
  }

  /**
   * Holt aggregierte Statistiken für eine Sequenz
   */
  async getSequenceStats(sequenceId: string): Promise<{
    total_sent: number;
    total_opened: number;
    total_clicked: number;
    total_unsubscribed: number;
    open_rate: number;
    click_rate: number;
  }> {
    const stats = await db.queryOne<{
      total_sent: string;
      total_opened: string;
      total_clicked: string;
      total_unsubscribed: string;
    }>(
      `SELECT 
         COUNT(*)::text as total_sent,
         COUNT(opened_at)::text as total_opened,
         COUNT(clicked_at)::text as total_clicked,
         COUNT(unsubscribed_at)::text as total_unsubscribed
       FROM email_tracking et
       JOIN email_sequence_enrollments ese ON et.enrollment_id = ese.id
       WHERE ese.sequence_id = $1`,
      [sequenceId]
    );

    const totalSent = parseInt(stats?.total_sent || '0', 10);
    const totalOpened = parseInt(stats?.total_opened || '0', 10);
    const totalClicked = parseInt(stats?.total_clicked || '0', 10);
    const totalUnsubscribed = parseInt(stats?.total_unsubscribed || '0', 10);

    return {
      total_sent: totalSent,
      total_opened: totalOpened,
      total_clicked: totalClicked,
      total_unsubscribed: totalUnsubscribed,
      open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
      click_rate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0
    };
  }

  /**
   * Holt Statistiken für einen einzelnen Sequenz-Schritt
   */
  async getStepStats(stepId: string): Promise<{
    total_sent: number;
    total_opened: number;
    total_clicked: number;
    open_rate: number;
    click_rate: number;
  }> {
    const stats = await db.queryOne<{
      total_sent: string;
      total_opened: string;
      total_clicked: string;
    }>(
      `SELECT 
         COUNT(*)::text as total_sent,
         COUNT(opened_at)::text as total_opened,
         COUNT(clicked_at)::text as total_clicked
       FROM email_tracking
       WHERE step_id = $1`,
      [stepId]
    );

    const totalSent = parseInt(stats?.total_sent || '0', 10);
    const totalOpened = parseInt(stats?.total_opened || '0', 10);
    const totalClicked = parseInt(stats?.total_clicked || '0', 10);

    return {
      total_sent: totalSent,
      total_opened: totalOpened,
      total_clicked: totalClicked,
      open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
      click_rate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0
    };
  }

  // ===========================================================================
  // Generate 1x1 Transparent GIF
  // ===========================================================================

  /**
   * Gibt ein 1x1 transparentes GIF als Buffer zurück
   * Wird von der Tracking-Route verwendet
   */
  static getTransparentPixel(): Buffer {
    // Base64-encoded 1x1 transparent GIF
    const base64Pixel = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    return Buffer.from(base64Pixel, 'base64');
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

export default getEmailService;
