// =============================================================================
// src/integrations/cituro.ts
// Cituro Integration - Meeting Booking & Scheduling
// API: https://app.cituro.com/api | Auth: X-API-KEY
// =============================================================================

import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config/index.js';

// =============================================================================
// Types – CRM Lead mapping & Cituro API
// =============================================================================

/** CRM lead shape for sync: maps first_name, last_name, email, phone → Cituro customer */
export interface CituroCrmLead {
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
}

/** Cituro customer (from GET /customers or POST /customers) */
export interface CituroCustomer {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobilePhone?: string;
  [key: string]: unknown;
}

/** List response for GET /customers?filter[email]=... */
export interface CituroCustomersResponse {
  data?: CituroCustomer[];
  [key: string]: unknown;
}

/** Single customer response (POST /customers) */
export interface CituroCustomerResponse {
  data?: CituroCustomer;
  id?: string;
  [key: string]: unknown;
}

/** Options for createMeetingWithLead (optional employee/resource, duration) */
export interface CreateMeetingWithLeadOptions {
  durationMinutes?: number;
  employeeId?: string;
}

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
  /** Base URL for app.cituro.com API (default https://app.cituro.com/api) */
  private baseUrl: string;
  /** Service ID for "Meeting with Lead" – from CITURO_SERVICE_ID */
  private serviceId: string;

  constructor(apiKey?: string, subdomain?: string) {
    this.apiKey = apiKey ?? config.cituro?.apiKey ?? '';
    this.subdomain = subdomain ?? config.cituro?.subdomain ?? '';
    this.baseUrl = config.cituro?.baseUrl ?? 'https://app.cituro.com/api';
    this.serviceId = config.cituro?.serviceId ?? '';

    if (!this.apiKey) {
      console.warn('⚠️ CituroService: CITURO_API_KEY not configured');
    }

    // Cituro API: Base URL https://app.cituro.com/api, auth via X-API-KEY (not Bearer)
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Response interceptor: handle 401 (auth) and 429 (rate limit) explicitly
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const statusCode = error.response?.status ?? 500;
        const data = error.response?.data as { message?: string; error?: string } | undefined;
        const cituroMessage = data?.message ?? data?.error;
        if (statusCode === 401) {
          throw new CituroError('Cituro API authentication failed (invalid or missing X-API-KEY)', 401, cituroMessage);
        }
        if (statusCode === 429) {
          throw new CituroError('Cituro API rate limit exceeded', 429, cituroMessage);
        }
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
    return !!this.apiKey;
  }

  /** Whether "Meeting with Lead" service ID is set (required for createMeetingWithLead) */
  isMeetingServiceConfigured(): boolean {
    return !!this.serviceId;
  }

  // ===========================================================================
  // Health Check
  // ===========================================================================

  async testConnection(): Promise<{ connected: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { connected: false, error: 'Cituro API key not configured' };
    }
    try {
      // Lightweight check: list customers with limit 1
      await this.client.get('/customers', { params: { 'page[limit]': 1 } });
      return { connected: true };
    } catch (error) {
      const message = error instanceof CituroError
        ? (error.cituroMessage ?? error.message)
        : (error as Error).message;
      return { connected: false, error: message };
    }
  }

  // ===========================================================================
  // Task 1: Sync Client (Get or Create) – ensures a client exists in Cituro
  // ===========================================================================

  /**
   * Ensures a client exists in Cituro for the given CRM lead.
   * 1. Checks existence via GET /customers?filter[email]=<email>
   * 2. If not found, creates/updates via POST /customers?key=email (Cituro docs:
   *    key=email makes the API search by email and update if found, else create)
   * Returns the Cituro customerId (UUID).
   */
  async syncCituroClient(crmLead: CituroCrmLead): Promise<string> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }
    const email = crmLead.email?.trim();
    if (!email) {
      throw new CituroError('CRM lead email is required for sync', 400);
    }

    // Step 1: Check existence – GET /customers?filter[email]=<email>
    const listRes = await this.client.get<CituroCustomersResponse>('/customers', {
      params: { 'filter[email]': email }
    });
    const list: CituroCustomer[] = (listRes.data?.data ?? (Array.isArray(listRes.data) ? listRes.data : [])) as CituroCustomer[];
    const existing = list[0];
    if (existing?.id) {
      return existing.id;
    }

    // Step 2: Create or update in one call – POST /customers?key=email
    // key=email: API looks up by email and updates if found, otherwise creates (efficient single-step upsert)
    const payload = {
      firstName: crmLead.first_name ?? '',
      lastName: crmLead.last_name ?? '',
      email,
      mobilePhone: crmLead.phone ?? undefined
    };
    const createRes = await this.client.post<CituroCustomerResponse>('/customers', payload, {
      params: { key: 'email' }
    });
    const resData = createRes.data as CituroCustomerResponse & { id?: string };
    const created = resData?.data ?? (resData && 'id' in resData ? (resData as CituroCustomer) : undefined);
    const id = created?.id ?? resData?.id;
    if (!id) {
      throw new CituroError('Cituro did not return a customer ID', 502);
    }
    return id;
  }

  // ===========================================================================
  // Task 2: Create "Meeting with Lead" Appointment
  // ===========================================================================

  /**
   * Creates a "Meeting with Lead" appointment in Cituro for the given customer and start time.
   * POST /appointments with startDate (ISO 8601), booking.customerId, items[].serviceId/duration/resources.
   */
  async createMeetingWithLead(
    cituroCustomerId: string,
    startTime: Date | string,
    options: CreateMeetingWithLeadOptions = {}
  ): Promise<{ appointmentId: string; [key: string]: unknown }> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }
    if (!this.serviceId) {
      throw new CituroError('CITURO_SERVICE_ID not configured (required for Meeting with Lead)', 500);
    }
    const startDate = typeof startTime === 'string' ? startTime : startTime.toISOString().replace(/\.\d{3}Z$/, '');
    const duration = options.durationMinutes ?? 30;
    const item: { serviceId: string; duration: number; resources?: Array<{ id: string }> } = {
      serviceId: this.serviceId,
      duration
    };
    if (options.employeeId) {
      item.resources = [{ id: options.employeeId }];
    }
    const payload = {
      startDate,
      booking: { customerId: cituroCustomerId },
      items: [item]
    };
    const res = await this.client.post<{ data?: { id?: string }; id?: string }>('/appointments', payload);
    const appointmentId = res.data?.data?.id ?? (res.data as { id?: string })?.id;
    if (!appointmentId) {
      throw new CituroError('Cituro did not return an appointment ID', 502);
    }
    return { appointmentId, ...(res.data as object) };
  }

  // ===========================================================================
  // Booking Link Management
  // ===========================================================================

  /**
   * Generate a booking link for a lead.
   * Tries POST /booking-links; if the Cituro API returns 404 (endpoint not available),
   * returns the configured CITURO_BOOKING_URL so the invite email can still be sent.
   */
  async generateBookingLink(data: CituroBookingLinkData): Promise<CituroBookingLink> {
    if (!this.isConfigured()) {
      throw new CituroError('Cituro not configured', 500);
    }

    const fallbackUrl = config.cituro?.bookingUrl;
    const payload = {
      email: data.lead_email,
      name: data.lead_name,
      meeting_type: data.meeting_type || 'consultation',
      duration_minutes: data.duration_minutes || 30,
      timezone: data.timezone || 'Europe/Berlin',
      message: data.message
    };

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, v]) => v !== undefined)
    );

    try {
      const response = await this.client.post<CituroBookingLink>('/booking-links', cleanPayload);
      if (response.data?.url) {
        return response.data;
      }
    } catch (error) {
      const status = (error as CituroError).statusCode ?? (error as { response?: { status?: number } })?.response?.status;
      if (status === 404 && fallbackUrl) {
        return {
          id: 'default',
          url: fallbackUrl,
          created_at: new Date().toISOString()
        };
      }
      if (fallbackUrl) {
        console.warn(`[Cituro] Booking-links API failed (${status}), using CITURO_BOOKING_URL`);
        return {
          id: 'default',
          url: fallbackUrl,
          created_at: new Date().toISOString()
        };
      }
      console.error(`[Cituro] Failed to generate booking link:`, error);
      throw error;
    }

    if (fallbackUrl) {
      return {
        id: 'default',
        url: fallbackUrl,
        created_at: new Date().toISOString()
      };
    }
    throw new CituroError('Cituro returned no booking URL and CITURO_BOOKING_URL is not set', 502);
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
