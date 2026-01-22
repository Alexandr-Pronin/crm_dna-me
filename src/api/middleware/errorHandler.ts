// =============================================================================
// src/api/middleware/errorHandler.ts
// Global Error Handler for Fastify
// =============================================================================

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError, isAppError } from '../../errors/index.js';

// =============================================================================
// Error Response Interface
// =============================================================================

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

// =============================================================================
// Format Zod Errors
// =============================================================================

function formatZodError(error: ZodError): { message: string; details: Record<string, unknown> } {
  const errors = error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message
  }));

  return {
    message: 'Validation failed',
    details: { validationErrors: errors }
  };
}

// =============================================================================
// Error Handler
// =============================================================================

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Log the error
  request.log.error({
    err: error,
    requestId: request.id,
    url: request.url,
    method: request.method
  }, 'Request error');

  // Default error response
  let statusCode = 500;
  let response: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: request.id
    }
  };

  // Handle AppError (our custom errors)
  if (isAppError(error)) {
    statusCode = error.statusCode;
    response = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: request.id
      }
    };
  }
  // Handle Zod validation errors
  else if (error instanceof ZodError) {
    statusCode = 400;
    const formatted = formatZodError(error);
    response = {
      error: {
        code: 'VALIDATION_ERROR',
        message: formatted.message,
        details: formatted.details,
        requestId: request.id
      }
    };
  }
  // Handle Fastify errors (e.g., validation, rate limit)
  else if ('statusCode' in error && typeof error.statusCode === 'number') {
    statusCode = error.statusCode;
    response = {
      error: {
        code: (error as FastifyError).code || 'FASTIFY_ERROR',
        message: error.message,
        requestId: request.id
      }
    };
  }

  // Remove details in production for 5xx errors
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    response.error.message = 'An unexpected error occurred';
    delete response.error.details;
  }

  reply.status(statusCode).send(response);
}

// =============================================================================
// Not Found Handler
// =============================================================================

export function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  request.log.warn({
    requestId: request.id,
    url: request.url,
    method: request.method
  }, 'Route not found');

  reply.status(404).send({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
      requestId: request.id
    }
  });
}

export default errorHandler;
