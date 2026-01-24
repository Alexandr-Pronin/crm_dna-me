// =============================================================================
// src/integrations/cituro.ts
// Cituro Integration - Meeting Booking & Scheduling
// =============================================================================

import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config/index.js';

// =============================================================================
// Types
// =============================================================================

export interface CituroBookingLinkData {
  lead_email: string;
  lead_name?: string;
  meeting_type?: string;
  duration_minutes?: number;
  timezone?: string;
  message?: string;
}

export interface CituroBookingLink {
  id: string;
  url: string;
  expires_at?: string;
  created_at: string;
}

export interface CituroAvailabilityRequest {
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
  duration_minutes?: number;
  timezone?: string;
}

export interface CituroTimeSlot {
  start: string; // ISO datetime string
  end: string; // ISO datetime string
  available: boolean;
}

export interface CituroAvailability {
  slots: CituroTimeSlot[];
  timezone: string;
}

export interface CituroMeetingInvitation {
  lead_email: string;
  lead_name?: string;
  meeting_type?: string;
  start_time: string; // ISO datetime string
  end_time: string; // ISO datetime string
  timezone?: string;
  subject?: string;
  message?: string;
  location?: string; // For video calls, this might be a link
}

export interface CituroMeeting {
  id: string;
  lead_email: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  booking_link_id?: string;
  created_at: string;
}

// =============================================================================
// Error Types
// =============================================================================

export class CituroError extends Error {
  public readonly statusCode: number;
  public readonly cituroMessage?: string;

  constructor(message: string, statusCode: number, cituroMessage?: string) {
    super(message);
    this.name = 'CituroError';
    this.statusCode = statusCode;
    this.cituroMessage = cituroMessage;
  }
}

// =============================================================================
// Cituro Service Class
// =============================================================================

export class CituroService {
  private client: AxiosInstance;
  private apiKey: string;
  private subdomain: string;

  constructor(apiKey?: string, subdomain?: string) {
    this.apiKey = apiKey || config.cituro?.apiKey || '';
    this.subdomain = subdomain || config.cituro?.subdomain || '';

    if (!this.apiKey || !this.subdomain) {
      console.warn('⚠️ CituroService: API key or subdomain not configured');
    }

    // Cituro API base URL - adjust based on actual API documentation
    this.client = axios.create({
      baseURL: `https://${this.subdomain}.cituro.com/api/v1`,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const statusCode = error.response?.status || 500;
        const cituroMessage = (error.response?.data as { message?: string; error?: string })?.message 
          || (error.response?.data as { message?: string; error?: string })?.error;
        
        throw new CituroError(
          `Cituro API error: ${error.message}`,
          statusCode,
          cituroMessage
        );
      }
    );
  }

  // ===========================================================================
  // Configuration Check
  // ===========================================================================

  isConfigured(): boolean {
    return !!(this.apiKey && this.subdomain);
  }

  // ===========================================================================
  // Health Check
  // ===========================================================================

  async testConnection(): Promise<{ connected: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { connected: false, error: 'Cituro API key or subdomain not configured' };
    }

    try {
      // Try to get account info or availability to test connection
      // Adjust endpoint based on actual Cituro API
      await this.client.get('/account');
      return { connected: true };
    } catch (error) {
      const message = error instanceof CituroError 
        ? error.cituroMessage || error.message 
        : (error as Error).message;
      return { connected: false, error: message };
    }
  }

  // ===========================================================================
  // Booking Link Management
  // ===========================================================================

  /**
   * Generate a booking link for a lead
   * Creates a personalized booking link that can be sent to the lead
   */
  async generateBookingLink(data: CituroBookingLinkData): Promise<CituroBookingLink> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }

    const payload = {
      email: data.lead_email,
      name: data.lead_name,
      meeting_type: data.meeting_type || 'consultation',
      duration_minutes: data.duration_minutes || 30,
      timezone: data.timezone || 'Europe/Berlin',
      message: data.message
    };

    // Remove undefined values
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, v]) => v !== undefined)
    );

    console.log(`[Cituro] Generating booking link for: ${data.lead_email}`);
    
    try {
      // Adjust endpoint and payload structure based on actual Cituro API
      const response = await this.client.post<CituroBookingLink>('/booking-links', cleanPayload);
      console.log(`[Cituro] Booking link created: ${response.data.url}`);
      
      return response.data;
    } catch (error) {
      console.error(`[Cituro] Failed to generate booking link:`, error);
      throw error;
    }
  }

  /**
   * Get booking link by ID
   */
  async getBookingLink(linkId: string): Promise<CituroBookingLink> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }

    const response = await this.client.get<CituroBookingLink>(`/booking-links/${linkId}`);
    return response.data;
  }

  /**
   * Revoke/delete a booking link
   */
  async revokeBookingLink(linkId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }

    await this.client.delete(`/booking-links/${linkId}`);
    console.log(`[Cituro] Booking link revoked: ${linkId}`);
  }

  // ===========================================================================
  // Availability Management
  // ===========================================================================

  /**
   * Check availability for booking
   * Returns available time slots within the specified date range
   */
  async checkAvailability(request?: CituroAvailabilityRequest): Promise<CituroAvailability> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }

    const params: Record<string, string> = {};
    
    if (request?.start_date) {
      params.start_date = request.start_date;
    }
    if (request?.end_date) {
      params.end_date = request.end_date;
    }
    if (request?.duration_minutes) {
      params.duration_minutes = request.duration_minutes.toString();
    }
    if (request?.timezone) {
      params.timezone = request.timezone;
    }

    console.log(`[Cituro] Checking availability`);
    const response = await this.client.get<CituroAvailability>('/availability', { params });
    return response.data;
  }

  /**
   * Get available slots for a specific date
   */
  async getAvailableSlotsForDate(date: string, durationMinutes: number = 30): Promise<CituroTimeSlot[]> {
    const availability = await this.checkAvailability({
      start_date: date,
      end_date: date,
      duration_minutes: durationMinutes
    });
    
    return availability.slots.filter(slot => slot.available);
  }

  // ===========================================================================
  // Meeting Invitations
  // ===========================================================================

  /**
   * Send meeting invitation to a lead
   * Creates a meeting and sends invitation email
   */
  async sendMeetingInvitation(data: CituroMeetingInvitation): Promise<CituroMeeting> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }

    const payload = {
      email: data.lead_email,
      name: data.lead_name,
      meeting_type: data.meeting_type || 'consultation',
      start_time: data.start_time,
      end_time: data.end_time,
      timezone: data.timezone || 'Europe/Berlin',
      subject: data.subject || `Meeting Invitation - ${data.meeting_type || 'Consultation'}`,
      message: data.message,
      location: data.location
    };

    // Remove undefined values
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, v]) => v !== undefined)
    );

    console.log(`[Cituro] Sending meeting invitation to: ${data.lead_email}`);
    
    try {
      // Adjust endpoint based on actual Cituro API
      const response = await this.client.post<CituroMeeting>('/meetings/invite', cleanPayload);
      console.log(`[Cituro] Meeting invitation sent. Meeting ID: ${response.data.id}`);
      
      return response.data;
    } catch (error) {
      console.error(`[Cituro] Failed to send meeting invitation:`, error);
      throw error;
    }
  }

  /**
   * Get meeting by ID
   */
  async getMeeting(meetingId: string): Promise<CituroMeeting> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }

    const response = await this.client.get<CituroMeeting>(`/meetings/${meetingId}`);
    return response.data;
  }

  /**
   * List meetings for a lead
   */
  async getMeetingsByEmail(email: string): Promise<CituroMeeting[]> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }

    const response = await this.client.get<CituroMeeting[]>('/meetings', {
      params: { email }
    });
    return response.data;
  }

  /**
   * Cancel a meeting
   */
  async cancelMeeting(meetingId: string, reason?: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }

    const payload = reason ? { reason } : {};
    await this.client.post(`/meetings/${meetingId}/cancel`, payload);
    console.log(`[Cituro] Meeting cancelled: ${meetingId}`);
  }

  /**
   * Update meeting time
   */
  async updateMeetingTime(
    meetingId: string, 
    newStartTime: string, 
    newEndTime: string
  ): Promise<CituroMeeting> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }

    const response = await this.client.patch<CituroMeeting>(`/meetings/${meetingId}`, {
      start_time: newStartTime,
      end_time: newEndTime
    });
    
    console.log(`[Cituro] Meeting time updated: ${meetingId}`);
    return response.data;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let cituroServiceInstance: CituroService | null = null;

export function getCituroService(): CituroService {
  if (!cituroServiceInstance) {
    cituroServiceInstance = new CituroService();
  }
  return cituroServiceInstance;
}

export default getCituroService;
