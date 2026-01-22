// =============================================================================
// src/integrations/moco.ts
// Moco Integration - German Finance System
// =============================================================================

import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config/index.js';

// =============================================================================
// Types
// =============================================================================

export interface MocoCustomerData {
  name: string;
  email?: string;
  vat_id?: string;
  address?: string;
  country?: string;
  website?: string;
  phone?: string;
  info?: string;
}

export interface MocoOfferData {
  customer_id: string;
  title: string;
  value: number;
  items?: MocoOfferItem[];
  info?: string;
}

export interface MocoOfferItem {
  title: string;
  quantity: number;
  unit_price: number;
  net_total?: number;
}

export interface MocoCustomer {
  id: string;
  name: string;
  email?: string;
  vat_identifier?: string;
  address?: string;
  country_code?: string;
  created_at: string;
  updated_at: string;
}

export interface MocoOffer {
  id: string;
  customer_id: string;
  title: string;
  date: string;
  status: string;
  net_total: number;
  created_at: string;
  updated_at: string;
}

export interface MocoInvoice {
  id: string;
  customer_id: string;
  offer_id?: string;
  title: string;
  status: string;
  net_total: number;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Error Types
// =============================================================================

export class MocoError extends Error {
  public readonly statusCode: number;
  public readonly mocoMessage?: string;

  constructor(message: string, statusCode: number, mocoMessage?: string) {
    super(message);
    this.name = 'MocoError';
    this.statusCode = statusCode;
    this.mocoMessage = mocoMessage;
  }
}

// =============================================================================
// Moco Service Class
// =============================================================================

export class MocoService {
  private client: AxiosInstance;
  private apiKey: string;
  private subdomain: string;

  constructor(apiKey?: string, subdomain?: string) {
    this.apiKey = apiKey || config.moco.apiKey || '';
    this.subdomain = subdomain || config.moco.subdomain || '';

    if (!this.apiKey || !this.subdomain) {
      console.warn('⚠️ MocoService: API key or subdomain not configured');
    }

    this.client = axios.create({
      baseURL: `https://${this.subdomain}.mocoapp.com/api/v1`,
      headers: {
        'Authorization': `Token token=${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const statusCode = error.response?.status || 500;
        const mocoMessage = (error.response?.data as { message?: string })?.message;
        
        throw new MocoError(
          `Moco API error: ${error.message}`,
          statusCode,
          mocoMessage
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
      return { connected: false, error: 'Moco API key or subdomain not configured' };
    }

    try {
      // Try to list customers with limit 1 to test connection
      await this.client.get('/customers', { params: { per_page: 1 } });
      return { connected: true };
    } catch (error) {
      const message = error instanceof MocoError 
        ? error.mocoMessage || error.message 
        : (error as Error).message;
      return { connected: false, error: message };
    }
  }

  // ===========================================================================
  // Customer Management
  // ===========================================================================

  /**
   * Create a customer in Moco
   */
  async createCustomer(data: MocoCustomerData): Promise<string> {
    if (!this.isConfigured()) {
      throw new MocoError('Moco not configured', 500);
    }

    const payload = {
      name: data.name,
      email: data.email,
      vat_identifier: data.vat_id,
      address: data.address,
      country_code: data.country || 'DE',
      website: data.website,
      phone: data.phone,
      info: data.info
    };

    // Remove undefined values
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, v]) => v !== undefined)
    );

    console.log(`[Moco] Creating customer: ${data.name}`);
    const response = await this.client.post<MocoCustomer>('/customers', cleanPayload);
    console.log(`[Moco] Customer created with ID: ${response.data.id}`);
    
    return response.data.id;
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<MocoCustomer> {
    if (!this.isConfigured()) {
      throw new MocoError('Moco not configured', 500);
    }

    const response = await this.client.get<MocoCustomer>(`/customers/${customerId}`);
    return response.data;
  }

  /**
   * Search customers by email
   */
  async findCustomerByEmail(email: string): Promise<MocoCustomer | null> {
    if (!this.isConfigured()) {
      throw new MocoError('Moco not configured', 500);
    }

    try {
      const response = await this.client.get<MocoCustomer[]>('/customers', {
        params: { email }
      });
      
      return response.data.length > 0 ? response.data[0] : null;
    } catch (error) {
      if (error instanceof MocoError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Search customers by name
   */
  async findCustomerByName(name: string): Promise<MocoCustomer | null> {
    if (!this.isConfigured()) {
      throw new MocoError('Moco not configured', 500);
    }

    try {
      const response = await this.client.get<MocoCustomer[]>('/customers', {
        params: { name }
      });
      
      return response.data.length > 0 ? response.data[0] : null;
    } catch (error) {
      if (error instanceof MocoError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(customerId: string, data: Partial<MocoCustomerData>): Promise<MocoCustomer> {
    if (!this.isConfigured()) {
      throw new MocoError('Moco not configured', 500);
    }

    const payload: Record<string, unknown> = {};
    
    if (data.name) payload.name = data.name;
    if (data.email) payload.email = data.email;
    if (data.vat_id) payload.vat_identifier = data.vat_id;
    if (data.address) payload.address = data.address;
    if (data.country) payload.country_code = data.country;
    if (data.website) payload.website = data.website;
    if (data.phone) payload.phone = data.phone;
    if (data.info) payload.info = data.info;

    console.log(`[Moco] Updating customer: ${customerId}`);
    const response = await this.client.put<MocoCustomer>(`/customers/${customerId}`, payload);
    return response.data;
  }

  // ===========================================================================
  // Offer Management
  // ===========================================================================

  /**
   * Create an offer/quote in Moco
   */
  async createOffer(data: MocoOfferData): Promise<string> {
    if (!this.isConfigured()) {
      throw new MocoError('Moco not configured', 500);
    }

    const today = new Date().toISOString().split('T')[0];
    
    const items = data.items || [{
      title: data.title,
      quantity: 1,
      unit_price: data.value,
      net_total: data.value
    }];

    const payload = {
      customer_id: data.customer_id,
      title: data.title,
      date: today,
      info: data.info,
      items: items.map(item => ({
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        net_total: item.net_total || (item.quantity * item.unit_price)
      }))
    };

    console.log(`[Moco] Creating offer: ${data.title} for customer ${data.customer_id}`);
    const response = await this.client.post<MocoOffer>('/offers', payload);
    console.log(`[Moco] Offer created with ID: ${response.data.id}`);
    
    return response.data.id;
  }

  /**
   * Get offer by ID
   */
  async getOffer(offerId: string): Promise<MocoOffer> {
    if (!this.isConfigured()) {
      throw new MocoError('Moco not configured', 500);
    }

    const response = await this.client.get<MocoOffer>(`/offers/${offerId}`);
    return response.data;
  }

  /**
   * List offers for a customer
   */
  async getOffersByCustomer(customerId: string): Promise<MocoOffer[]> {
    if (!this.isConfigured()) {
      throw new MocoError('Moco not configured', 500);
    }

    const response = await this.client.get<MocoOffer[]>('/offers', {
      params: { customer_id: customerId }
    });
    return response.data;
  }

  // ===========================================================================
  // Invoice Management
  // ===========================================================================

  /**
   * Create an invoice from an offer
   */
  async createInvoiceFromOffer(offerId: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new MocoError('Moco not configured', 500);
    }

    console.log(`[Moco] Creating invoice from offer: ${offerId}`);
    const response = await this.client.post<MocoInvoice>(`/offers/${offerId}/create_invoice`);
    console.log(`[Moco] Invoice created with ID: ${response.data.id}`);
    
    return response.data.id;
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<MocoInvoice> {
    if (!this.isConfigured()) {
      throw new MocoError('Moco not configured', 500);
    }

    const response = await this.client.get<MocoInvoice>(`/invoices/${invoiceId}`);
    return response.data;
  }

  /**
   * List invoices for a customer
   */
  async getInvoicesByCustomer(customerId: string): Promise<MocoInvoice[]> {
    if (!this.isConfigured()) {
      throw new MocoError('Moco not configured', 500);
    }

    const response = await this.client.get<MocoInvoice[]>('/invoices', {
      params: { customer_id: customerId }
    });
    return response.data;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let mocoServiceInstance: MocoService | null = null;

export function getMocoService(): MocoService {
  if (!mocoServiceInstance) {
    mocoServiceInstance = new MocoService();
  }
  return mocoServiceInstance;
}

export default getMocoService;
