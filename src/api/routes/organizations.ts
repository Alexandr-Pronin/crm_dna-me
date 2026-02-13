// =============================================================================
// src/api/routes/organizations.ts
// Organization Management API Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { validateApiKey } from '../middleware/apiKey.js';
import { ValidationError } from '../../errors/index.js';
import { getOrganizationService } from '../../services/organizationService.js';
import type { Organization } from '../../types/index.js';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  organizationFiltersSchema,
  organizationIdParamSchema,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
  type OrganizationFiltersInput,
  type OrganizationResponse,
  type OrganizationListResponse
} from '../schemas/organizations.js';

// =============================================================================
// Helper Functions
// =============================================================================

function transformOrganizationResponse(organization: Organization): OrganizationResponse {
  return {
    id: organization.id,
    name: organization.name,
    domain: organization.domain ?? null,
    industry: organization.industry ?? null,
    company_size: organization.company_size ?? null,
    country: organization.country ?? null,
    portal_id: organization.portal_id ?? null,
    moco_id: organization.moco_id ?? null,
    metadata: organization.metadata ?? {},
    created_at: organization.created_at?.toISOString?.() ?? (organization.created_at as unknown as string),
    updated_at: organization.updated_at?.toISOString?.() ?? (organization.updated_at as unknown as string)
  };
}

// =============================================================================
// Route Registration
// =============================================================================

export async function organizationsRoutes(fastify: FastifyInstance): Promise<void> {
  const organizationService = getOrganizationService();

  // ===========================================================================
  // GET /api/v1/organizations
  // ===========================================================================
  fastify.get<{
    Querystring: OrganizationFiltersInput;
    Reply: OrganizationListResponse;
  }>(
    '/organizations',
    {
      preHandler: validateApiKey,
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object', additionalProperties: true } },
              pagination: { type: 'object', additionalProperties: true }
            }
          }
        }
      }
    },
    async (request) => {
      const parseResult = organizationFiltersSchema.safeParse(request.query);
      if (!parseResult.success) {
        throw new ValidationError('Invalid organization filters', {
          validationErrors: parseResult.error.errors
        });
      }

      const result = await organizationService.getOrganizations(parseResult.data);
      return {
        data: result.data.map(transformOrganizationResponse),
        pagination: result.pagination
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/organizations/:id
  // ===========================================================================
  fastify.get<{
    Params: { id: string };
    Reply: OrganizationResponse;
  }>(
    '/organizations/:id',
    {
      preHandler: validateApiKey,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const parseResult = organizationIdParamSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw new ValidationError('Invalid organization ID', {
          validationErrors: parseResult.error.errors
        });
      }

      const organization = await organizationService.getOrganizationById(parseResult.data.id);
      return transformOrganizationResponse(organization);
    }
  );

  // ===========================================================================
  // POST /api/v1/organizations
  // ===========================================================================
  fastify.post<{
    Body: CreateOrganizationInput;
    Reply: OrganizationResponse;
  }>(
    '/organizations',
    {
      preHandler: validateApiKey,
      schema: {}
    },
    async (request) => {
      const parseResult = createOrganizationSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid organization data', {
          validationErrors: parseResult.error.errors
        });
      }

      const organization = await organizationService.createOrganization(parseResult.data);
      return transformOrganizationResponse(organization);
    }
  );

  // ===========================================================================
  // PUT /api/v1/organizations/:id
  // ===========================================================================
  fastify.put<{
    Params: { id: string };
    Body: UpdateOrganizationInput;
    Reply: OrganizationResponse;
  }>(
    '/organizations/:id',
    {
      preHandler: validateApiKey,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const idParse = organizationIdParamSchema.safeParse(request.params);
      if (!idParse.success) {
        throw new ValidationError('Invalid organization ID', {
          validationErrors: idParse.error.errors
        });
      }

      const bodyParse = updateOrganizationSchema.safeParse(request.body);
      if (!bodyParse.success) {
        throw new ValidationError('Invalid organization data', {
          validationErrors: bodyParse.error.errors
        });
      }

      const organization = await organizationService.updateOrganization(idParse.data.id, bodyParse.data);
      return transformOrganizationResponse(organization);
    }
  );

  // ===========================================================================
  // DELETE /api/v1/organizations/:id
  // ===========================================================================
  fastify.delete<{
    Params: { id: string };
    Reply: { success: boolean };
  }>(
    '/organizations/:id',
    {
      preHandler: validateApiKey,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const parseResult = organizationIdParamSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw new ValidationError('Invalid organization ID', {
          validationErrors: parseResult.error.errors
        });
      }

      await organizationService.deleteOrganization(parseResult.data.id);
      return { success: true };
    }
  );
}
