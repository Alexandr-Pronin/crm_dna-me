// =============================================================================
// src/services/linkedinService.ts
// LinkedIn Integration Service – API availability check, OAuth, messaging
//
// IMPORTANT: LinkedIn Messaging API is NOT publicly available!
// Options:
//   A) SNAP (Sales Navigator API) – requires Sales Navigator license + partner agreement
//   B) Third-party gateway (e.g. Unipile ~$99/mo) – recommended if messaging needed
//   C) Manual fallback – save profile URL, user opens LinkedIn manually (DEFAULT)
//
// This service implements Option C by default and provides runtime checks
// to detect whether SNAP or gateway credentials are configured.
// =============================================================================

import axios, { type AxiosInstance } from 'axios';
import { db } from '../db/index.js';
import { config } from '../config/index.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import {
  BusinessLogicError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from '../errors/index.js';
import type { LinkedInConnection } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Describes which LinkedIn integration mode is active.
 *
 * - `none`            – No LinkedIn credentials configured at all
 * - `manual_fallback` – Only profile-link storage (DEFAULT)
 * - `oauth_basic`     – Standard OAuth configured (profile read, no messaging)
 * - `snap`            – Sales Navigator API partner access (full messaging)
 * - `gateway`         – Third-party gateway (e.g. Unipile) configured
 */
export type LinkedInIntegrationMode =
  | 'none'
  | 'manual_fallback'
  | 'oauth_basic'
  | 'snap'
  | 'gateway';

export interface LinkedInApiStatus {
  mode: LinkedInIntegrationMode;
  messaging_available: boolean;
  profile_read_available: boolean;
  oauth_configured: boolean;
  gateway_configured: boolean;
  snap_configured: boolean;
  details: string;
  required_scopes: string[];
  detected_scopes: string[];
  recommendations: string[];
}

export interface LinkedInOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

export interface LinkedInProfile {
  id: string;
  localizedFirstName?: string;
  localizedLastName?: string;
  profilePicture?: string;
  vanityName?: string;
}

export interface SaveProfileLinkInput {
  conversation_id: string;
  linkedin_profile_url: string;
  profile_name?: string;
}

// =============================================================================
// Constants
// =============================================================================

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

// Standard OAuth scopes (no messaging)
const STANDARD_SCOPES = ['openid', 'profile', 'email'];

// SNAP scopes (would include messaging – requires partner agreement)
const SNAP_SCOPES = ['r_organization_social', 'r_1st_connections_size', 'w_member_social'];

// Messaging-specific scope (only available to SNAP partners)
const MESSAGING_SCOPE = 'w_member_social';

// =============================================================================
// LinkedInService Class
// =============================================================================

export class LinkedInService {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: LINKEDIN_API_BASE,
      timeout: 15_000,
      headers: {
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
  }

  // ===========================================================================
  // API Availability Check  (CORE of this task)
  // ===========================================================================

  /**
   * Performs a comprehensive check of LinkedIn API availability.
   *
   * Detection logic:
   *  1. Check for gateway credentials (LINKEDIN_GATEWAY_API_KEY / LINKEDIN_GATEWAY_URL)
   *     → mode = 'gateway'
   *  2. Check for SNAP partner credentials (LINKEDIN_SNAP_PARTNER_ID)
   *     → mode = 'snap'
   *  3. Check for standard OAuth credentials (LINKEDIN_CLIENT_ID + SECRET)
   *     → mode = 'oauth_basic'  (profile only, NO messaging)
   *  4. None of the above → mode = 'manual_fallback'
   */
  async checkApiAvailability(): Promise<LinkedInApiStatus> {
    const linkedinConfig = config.linkedin;

    const oauthConfigured = !!(linkedinConfig.clientId && linkedinConfig.clientSecret);
    const gatewayConfigured = !!(linkedinConfig.gatewayApiKey && linkedinConfig.gatewayUrl);
    const snapConfigured = !!(linkedinConfig.snapPartnerId && oauthConfigured);

    // Determine active mode
    let mode: LinkedInIntegrationMode;
    let messagingAvailable = false;
    let profileReadAvailable = false;
    let details: string;
    let detectedScopes: string[] = [];
    const recommendations: string[] = [];

    if (gatewayConfigured) {
      mode = 'gateway';
      messagingAvailable = true;
      profileReadAvailable = true;
      details =
        'Third-party LinkedIn gateway configured. ' +
        'Messaging and profile access available via gateway API.';
      detectedScopes = ['messaging_read', 'messaging_write', 'profile_read'];
    } else if (snapConfigured) {
      mode = 'snap';
      messagingAvailable = true;
      profileReadAvailable = true;
      details =
        'LinkedIn Sales Navigator API (SNAP) partner credentials detected. ' +
        'Full messaging and profile access should be available. ' +
        'Verify partner agreement is active in LinkedIn Developer Portal.';
      detectedScopes = [...STANDARD_SCOPES, ...SNAP_SCOPES];
    } else if (oauthConfigured) {
      mode = 'oauth_basic';
      messagingAvailable = false;
      profileReadAvailable = true;
      details =
        'Standard LinkedIn OAuth configured. ' +
        'Profile data (name, email, photo) can be read. ' +
        'MESSAGING IS NOT AVAILABLE with standard OAuth. ' +
        'LinkedIn restricts direct messaging to SNAP partners or approved third-party gateways.';
      detectedScopes = [...STANDARD_SCOPES];

      recommendations.push(
        'To enable LinkedIn messaging, you need one of the following:',
        '1. LinkedIn Sales Navigator API (SNAP) partner access – requires Sales Navigator license + partner agreement with LinkedIn',
        '2. Third-party gateway service (recommended): Unipile (https://unipile.com) ~$99/month for 10 accounts',
        '3. Continue with manual fallback: store LinkedIn profile URLs and open them in-browser for messaging'
      );
    } else {
      mode = linkedinConfig.enabled ? 'manual_fallback' : 'none';
      messagingAvailable = false;
      profileReadAvailable = false;
      details = linkedinConfig.enabled
        ? 'LinkedIn integration enabled but no API credentials configured. ' +
          'Running in manual fallback mode: profile links are stored and can be opened in the browser.'
        : 'LinkedIn integration is not configured. ' +
          'Set ENABLE_LINKEDIN=true and provide credentials to enable.';

      if (linkedinConfig.enabled) {
        recommendations.push(
          'Manual fallback is active. Users can store LinkedIn profile URLs and open them directly.',
          'To upgrade, configure one of: standard OAuth (profile only), SNAP (full), or gateway (full).'
        );
      } else {
        recommendations.push(
          'Set ENABLE_LINKEDIN=true in your environment to enable LinkedIn integration.',
          'Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET for OAuth profile access.',
          'For messaging, see SNAP or gateway options above.'
        );
      }
    }

    // If we have OAuth tokens stored, try to validate them
    if (oauthConfigured && mode === 'oauth_basic') {
      const scopeCheckResult = await this.detectAvailableScopes();
      if (scopeCheckResult) {
        detectedScopes = scopeCheckResult;
        if (scopeCheckResult.includes(MESSAGING_SCOPE)) {
          messagingAvailable = true;
          mode = 'snap';
          details =
            'LinkedIn OAuth with messaging scope detected! ' +
            'Your app appears to have SNAP/partner-level access.';
          recommendations.length = 0;
        }
      }
    }

    const requiredScopes = messagingAvailable
      ? [...STANDARD_SCOPES, MESSAGING_SCOPE]
      : STANDARD_SCOPES;

    return {
      mode,
      messaging_available: messagingAvailable,
      profile_read_available: profileReadAvailable,
      oauth_configured: oauthConfigured,
      gateway_configured: gatewayConfigured,
      snap_configured: snapConfigured,
      details,
      required_scopes: requiredScopes,
      detected_scopes: detectedScopes,
      recommendations,
    };
  }

  // ===========================================================================
  // OAuth Helpers
  // ===========================================================================

  /**
   * Generates the LinkedIn OAuth authorization URL.
   * Only available when LINKEDIN_CLIENT_ID + SECRET are set.
   */
  getAuthUrl(state: string): string {
    const linkedinConfig = config.linkedin;

    if (!linkedinConfig.clientId || !linkedinConfig.clientSecret) {
      throw new BusinessLogicError(
        'LinkedIn OAuth is not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.',
        { mode: 'not_configured' }
      );
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: linkedinConfig.clientId,
      redirect_uri: linkedinConfig.redirectUri,
      state,
      scope: STANDARD_SCOPES.join(' '),
    });

    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for access + refresh tokens.
   */
  async exchangeCodeForToken(code: string): Promise<LinkedInOAuthTokens> {
    const linkedinConfig = config.linkedin;

    if (!linkedinConfig.clientId || !linkedinConfig.clientSecret) {
      throw new BusinessLogicError('LinkedIn OAuth is not configured');
    }

    try {
      const response = await axios.post(
        LINKEDIN_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: linkedinConfig.redirectUri,
          client_id: linkedinConfig.clientId,
          client_secret: linkedinConfig.clientSecret,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
        scope: response.data.scope,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new ExternalServiceError('LinkedIn', `Token exchange failed: ${msg}`);
    }
  }

  /**
   * Refresh an expired access token.
   */
  async refreshAccessToken(refreshToken: string): Promise<LinkedInOAuthTokens> {
    const linkedinConfig = config.linkedin;

    if (!linkedinConfig.clientId || !linkedinConfig.clientSecret) {
      throw new BusinessLogicError('LinkedIn OAuth is not configured');
    }

    try {
      const response = await axios.post(
        LINKEDIN_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: linkedinConfig.clientId,
          client_secret: linkedinConfig.clientSecret,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token ?? refreshToken,
        expires_in: response.data.expires_in,
        scope: response.data.scope,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new ExternalServiceError('LinkedIn', `Token refresh failed: ${msg}`);
    }
  }

  // ===========================================================================
  // Profile Operations
  // ===========================================================================

  /**
   * Fetch the authenticated user's LinkedIn profile.
   */
  async getProfile(accessToken: string): Promise<LinkedInProfile> {
    try {
      const response = await this.httpClient.get('/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return {
        id: response.data.sub,
        localizedFirstName: response.data.given_name,
        localizedLastName: response.data.family_name,
        profilePicture: response.data.picture,
        vanityName: response.data.name,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new ExternalServiceError('LinkedIn', `Profile fetch failed: ${msg}`);
    }
  }

  // ===========================================================================
  // Connection Management (DB)
  // ===========================================================================

  /**
   * Store or update a LinkedIn connection for a team member.
   */
  async storeConnection(
    teamMemberId: string,
    tokens: LinkedInOAuthTokens,
    profile: LinkedInProfile
  ): Promise<LinkedInConnection> {
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : null;

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    const existing = await db.queryOne<LinkedInConnection>(
      'SELECT * FROM linkedin_connections WHERE team_member_id = $1',
      [teamMemberId]
    );

    if (existing) {
      const updated = await db.queryOne<LinkedInConnection>(
        `UPDATE linkedin_connections
         SET access_token = $1,
             refresh_token = $2,
             token_expires_at = $3,
             linkedin_profile_id = $4,
             profile_data = $5::jsonb,
             is_active = true,
             updated_at = NOW()
         WHERE team_member_id = $6
         RETURNING *`,
        [
          encryptedAccessToken,
          encryptedRefreshToken,
          expiresAt,
          profile.id,
          JSON.stringify(profile),
          teamMemberId,
        ]
      );
      return updated!;
    }

    const created = await db.queryOne<LinkedInConnection>(
      `INSERT INTO linkedin_connections (
        team_member_id, linkedin_profile_id, access_token, refresh_token,
        token_expires_at, profile_data, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, true, NOW(), NOW())
      RETURNING *`,
      [
        teamMemberId,
        profile.id,
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt,
        JSON.stringify(profile),
      ]
    );

    return created!;
  }

  /**
   * Get the LinkedIn connection for a team member.
   */
  async getConnection(teamMemberId: string): Promise<LinkedInConnection | null> {
    return db.queryOne<LinkedInConnection>(
      'SELECT * FROM linkedin_connections WHERE team_member_id = $1 AND is_active = true',
      [teamMemberId]
    );
  }

  /**
   * Disconnect (deactivate) a LinkedIn connection.
   */
  async disconnect(teamMemberId: string): Promise<void> {
    const result = await db.execute(
      `UPDATE linkedin_connections
       SET is_active = false, access_token = NULL, refresh_token = NULL, updated_at = NOW()
       WHERE team_member_id = $1`,
      [teamMemberId]
    );

    if (result === 0) {
      throw new NotFoundError('LinkedIn connection', teamMemberId);
    }
  }

  /**
   * Get a valid (non-expired) access token, refreshing if needed.
   */
  async getValidAccessToken(teamMemberId: string): Promise<string | null> {
    const connection = await this.getConnection(teamMemberId);
    if (!connection || !connection.access_token) return null;

    const decryptedToken = this.decryptSafe(connection.access_token);

    // Check if token is expired
    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at);
      const bufferMs = 5 * 60 * 1000; // 5 minutes buffer

      if (expiresAt.getTime() - bufferMs <= Date.now()) {
        // Token expired or about to expire, try refresh
        if (connection.refresh_token) {
          try {
            const decryptedRefresh = this.decryptSafe(connection.refresh_token);
            const newTokens = await this.refreshAccessToken(decryptedRefresh);
            const profile = await this.getProfile(newTokens.access_token);
            await this.storeConnection(teamMemberId, newTokens, profile);
            return newTokens.access_token;
          } catch {
            console.warn(
              `[LinkedInService] Token refresh failed for member ${teamMemberId}`
            );
            return null;
          }
        }
        return null;
      }
    }

    return decryptedToken;
  }

  // ===========================================================================
  // Manual Fallback – Profile Link Storage  (Option C)
  // ===========================================================================

  /**
   * Save a LinkedIn profile link in the conversation metadata.
   * This is the manual fallback when no messaging API is available.
   * Users can click the link to open LinkedIn's messaging UI directly.
   */
  async saveProfileLink(input: SaveProfileLinkInput): Promise<{ success: boolean; profile_url: string }> {
    // Validate URL format
    if (!input.linkedin_profile_url.includes('linkedin.com/')) {
      throw new ValidationError('Invalid LinkedIn profile URL');
    }

    // Normalize the URL
    let profileUrl = input.linkedin_profile_url.trim();
    if (!profileUrl.startsWith('http')) {
      profileUrl = `https://${profileUrl}`;
    }

    // Store as conversation metadata
    await db.execute(
      `UPDATE conversations
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
         'linkedin_profile_url', $1::text,
         'linkedin_profile_name', $2::text
       ),
       updated_at = NOW()
       WHERE id = $3`,
      [profileUrl, input.profile_name ?? null, input.conversation_id]
    );

    return {
      success: true,
      profile_url: profileUrl,
    };
  }

  /**
   * Generate a direct messaging URL for a LinkedIn profile.
   * Opens the LinkedIn messaging interface in a new browser tab.
   */
  getMessagingUrl(profileUrl: string): string {
    // Clean and ensure the URL points to the messaging page
    const cleanUrl = profileUrl.replace(/\/$/, '');
    return `${cleanUrl}/overlay/new-message/`;
  }

  // ===========================================================================
  // Messaging  (stub – activated by mode)
  // ===========================================================================

  /**
   * Attempt to send a LinkedIn message.
   * Behaviour depends on the detected integration mode:
   *  - gateway → send via third-party API
   *  - snap    → send via LinkedIn SNAP API
   *  - other   → return an error with instructions
   */
  async sendMessage(
    teamMemberId: string,
    recipientProfileUrl: string,
    messageText: string
  ): Promise<{ success: boolean; mode: LinkedInIntegrationMode; details: string }> {
    const status = await this.checkApiAvailability();

    if (status.mode === 'gateway') {
      return this.sendViaGateway(teamMemberId, recipientProfileUrl, messageText);
    }

    if (status.mode === 'snap') {
      return this.sendViaSNAP(teamMemberId, recipientProfileUrl, messageText);
    }

    // For oauth_basic / manual_fallback / none → messaging not available
    const messagingUrl = this.getMessagingUrl(recipientProfileUrl);
    return {
      success: false,
      mode: status.mode,
      details:
        `LinkedIn messaging is not available in "${status.mode}" mode. ` +
        `Open the profile directly to send a message: ${messagingUrl}`,
    };
  }

  // ===========================================================================
  // Configuration Check Helpers
  // ===========================================================================

  isConfigured(): boolean {
    return config.linkedin.enabled;
  }

  isOAuthConfigured(): boolean {
    return !!(config.linkedin.clientId && config.linkedin.clientSecret);
  }

  isGatewayConfigured(): boolean {
    return !!(config.linkedin.gatewayApiKey && config.linkedin.gatewayUrl);
  }

  isSNAPConfigured(): boolean {
    return !!(config.linkedin.snapPartnerId && this.isOAuthConfigured());
  }

  // ===========================================================================
  // PRIVATE: Detect scopes from LinkedIn (requires stored tokens)
  // ===========================================================================

  private async detectAvailableScopes(): Promise<string[] | null> {
    // If we have at least one active connection, use its token to introspect
    const anyConnection = await db.queryOne<LinkedInConnection>(
      `SELECT * FROM linkedin_connections
       WHERE is_active = true AND access_token IS NOT NULL
       LIMIT 1`
    );

    if (!anyConnection) return null;

    try {
      const token = this.decryptSafe(anyConnection.access_token!);

      // Try /userinfo (available with openid scope)
      await this.httpClient.get('/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // If we got here, at least basic profile scopes work
      const scopes = [...STANDARD_SCOPES];

      // Try to detect messaging capability by checking a messaging endpoint
      try {
        await this.httpClient.get('/socialActions', {
          headers: { Authorization: `Bearer ${token}` },
          params: { q: 'NONE', count: 0 },
        });
        scopes.push(MESSAGING_SCOPE);
      } catch {
        // 403 or 404 = no messaging access (expected for standard OAuth)
      }

      return scopes;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // PRIVATE: Send via Gateway (e.g. Unipile)
  // ===========================================================================

  private async sendViaGateway(
    _teamMemberId: string,
    _recipientProfileUrl: string,
    _messageText: string
  ): Promise<{ success: boolean; mode: LinkedInIntegrationMode; details: string }> {
    const linkedinConfig = config.linkedin;

    if (!linkedinConfig.gatewayUrl || !linkedinConfig.gatewayApiKey) {
      return {
        success: false,
        mode: 'gateway',
        details: 'Gateway URL or API key not configured',
      };
    }

    // Gateway integration would go here.
    // Example with Unipile:
    //   POST {gatewayUrl}/api/v1/messages
    //   Headers: { Authorization: Bearer {gatewayApiKey} }
    //   Body: { provider: 'linkedin', recipient: profileUrl, text: messageText }
    //
    // This is a placeholder – implement when a gateway provider is selected.

    return {
      success: false,
      mode: 'gateway',
      details:
        'Gateway messaging is configured but the provider-specific implementation is pending. ' +
        'Please implement the HTTP call for your chosen gateway (e.g. Unipile, Botmaker).',
    };
  }

  // ===========================================================================
  // PRIVATE: Send via SNAP API
  // ===========================================================================

  private async sendViaSNAP(
    teamMemberId: string,
    _recipientProfileUrl: string,
    _messageText: string
  ): Promise<{ success: boolean; mode: LinkedInIntegrationMode; details: string }> {
    const accessToken = await this.getValidAccessToken(teamMemberId);
    if (!accessToken) {
      return {
        success: false,
        mode: 'snap',
        details: 'No valid LinkedIn access token. Please re-authenticate via OAuth.',
      };
    }

    // SNAP messaging API would go here.
    // LinkedIn SNAP endpoints:
    //   POST https://api.linkedin.com/v2/messages
    //   (requires partner-level access)
    //
    // This is a placeholder – implement when SNAP partner agreement is active.

    return {
      success: false,
      mode: 'snap',
      details:
        'SNAP partner credentials are configured but the messaging API implementation is pending. ' +
        'Verify your partner agreement is active in the LinkedIn Developer Portal.',
    };
  }

  // ===========================================================================
  // PRIVATE: Safe decrypt helper
  // ===========================================================================

  private decryptSafe(value: string): string {
    try {
      return decrypt(value);
    } catch {
      return value;
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let linkedinServiceInstance: LinkedInService | null = null;

export function getLinkedInService(): LinkedInService {
  if (!linkedinServiceInstance) {
    linkedinServiceInstance = new LinkedInService();
  }
  return linkedinServiceInstance;
}

export default { get instance() { return getLinkedInService(); } };
