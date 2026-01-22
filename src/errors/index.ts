// =============================================================================
// src/errors/index.ts
// Custom Error Classes for DNA Marketing Engine
// =============================================================================

// =============================================================================
// Base Application Error
// =============================================================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details })
      }
    };
  }
}

// =============================================================================
// Validation Error (400)
// =============================================================================

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

// =============================================================================
// Authentication Error (401)
// =============================================================================

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
  }
}

// =============================================================================
// Authorization Error (403)
// =============================================================================

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
  }
}

// =============================================================================
// Not Found Error (404)
// =============================================================================

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', true, { resource, identifier });
  }
}

// =============================================================================
// Conflict Error (409)
// =============================================================================

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

// =============================================================================
// Rate Limit Error (429)
// =============================================================================

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', true, { retryAfter });
  }
}

// =============================================================================
// Database Error (500)
// =============================================================================

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      `Database error: ${message}`,
      500,
      'DATABASE_ERROR',
      true,
      originalError ? { originalMessage: originalError.message } : undefined
    );
  }
}

// =============================================================================
// External Service Error (502)
// =============================================================================

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, originalError?: Error) {
    super(
      `External service error (${service}): ${message}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      true,
      { 
        service,
        ...(originalError && { originalMessage: originalError.message })
      }
    );
  }
}

// =============================================================================
// Webhook Error (400)
// =============================================================================

export class WebhookError extends AppError {
  constructor(message: string, source?: string) {
    super(message, 400, 'WEBHOOK_ERROR', true, { source });
  }
}

// =============================================================================
// HMAC Signature Error (401)
// =============================================================================

export class HmacSignatureError extends AppError {
  constructor(message: string = 'Invalid webhook signature') {
    super(message, 401, 'INVALID_SIGNATURE', true);
  }
}

// =============================================================================
// API Key Error (401)
// =============================================================================

export class ApiKeyError extends AppError {
  constructor(message: string = 'Invalid or missing API key') {
    super(message, 401, 'INVALID_API_KEY', true);
  }
}

// =============================================================================
// Business Logic Error (422)
// =============================================================================

export class BusinessLogicError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, 'BUSINESS_LOGIC_ERROR', true, details);
  }
}

// =============================================================================
// Error Type Guard
// =============================================================================

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// =============================================================================
// Error Factory
// =============================================================================

export function createError(
  type: 'validation' | 'notFound' | 'auth' | 'conflict' | 'database',
  message: string,
  details?: Record<string, unknown>
): AppError {
  switch (type) {
    case 'validation':
      return new ValidationError(message, details);
    case 'notFound':
      return new NotFoundError(message);
    case 'auth':
      return new AuthenticationError(message);
    case 'conflict':
      return new ConflictError(message, details);
    case 'database':
      return new DatabaseError(message);
    default:
      return new AppError(message);
  }
}
