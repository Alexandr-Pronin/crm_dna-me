// =============================================================================
// src/api/routes/triggers.ts
// Trigger Execution API Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateApiKey } from '../middleware/apiKey.js';
import { getTriggerService, type TriggerAction } from '../../services/triggerService.js';
import { db } from '../../db/index.js';
import { ValidationError, NotFoundError } from '../../errors/index.js';
import type { PipelineStage, AutomationStageConfig } from '../../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const triggerActionEnum = z.enum([
  'send_email',
  'create_moco_project',
  'create_moco_customer',
  'create_moco_offer',
  'send_cituro_booking',
  'send_slack_message'
]);

const executeTriggerSchema = z.object({
  action: triggerActionEnum,
  config: z.record(z.unknown()),
  context: z.object({
    deal_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
    stage_id: z.string().uuid().optional(),
    pipeline_id: z.string().uuid().optional()
  })
});

const saveTriggerConfigSchema = z.object({
  triggers: z.array(z.object({
    action: triggerActionEnum,
    name: z.string().max(255).optional(),
    description: z.string().optional(),
    config: z.record(z.unknown()),
    enabled: z.boolean().default(true)
  }))
});

const stageIdParamSchema = z.object({
  id: z.string().uuid()
});

// =============================================================================
// Type Definitions
// =============================================================================

interface IdParams {
  id: string;
}

interface ExecuteTriggerBody {
  action: TriggerAction;
  config: Record<string, unknown>;
  context: {
    deal_id?: string;
    lead_id?: string;
    stage_id?: string;
    pipeline_id?: string;
  };
}

interface StageTriggerConfig {
  action: TriggerAction;
  name?: string;
  description?: string;
  config: Record<string, unknown>;
  enabled?: boolean;
}

interface SaveTriggerConfigBody {
  triggers: StageTriggerConfig[];
}

// =============================================================================
// Route Registration
// =============================================================================

export async function triggersRoutes(fastify: FastifyInstance): Promise<void> {
  const triggerService = getTriggerService();

  // ===========================================================================
  // POST /api/v1/triggers/execute
  // ===========================================================================
  /**
   * Führt einen Trigger manuell aus.
   * Kann für Tests oder manuelle Aktionen verwendet werden.
   */
  fastify.post<{
    Body: ExecuteTriggerBody;
  }>(
    '/triggers/execute',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Triggers'],
        body: {
          type: 'object',
          required: ['action', 'config', 'context'],
          properties: {
            action: {
              type: 'string',
              enum: [
                'send_email',
                'create_moco_project',
                'create_moco_customer',
                'create_moco_offer',
                'send_cituro_booking',
                'send_slack_message'
              ]
            },
            config: {
              type: 'object',
              additionalProperties: true
            },
            context: {
              type: 'object',
              properties: {
                deal_id: { type: 'string', format: 'uuid' },
                lead_id: { type: 'string', format: 'uuid' },
                stage_id: { type: 'string', format: 'uuid' },
                pipeline_id: { type: 'string', format: 'uuid' }
              }
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              action: { type: 'string' },
              result: { type: 'object', additionalProperties: true },
              error: { type: 'string' }
            }
          },
          400: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const parseResult = executeTriggerSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Trigger-Daten', {
          validationErrors: parseResult.error.errors
        });
      }

      const { action, config, context } = parseResult.data;

      request.log.info({
        action,
        context
      }, 'Führe Trigger manuell aus');

      const result = await triggerService.executeAction(action, config, context);

      if (!result.success) {
        request.log.error({
          action,
          error: result.error
        }, 'Trigger-Ausführung fehlgeschlagen');
      }

      return result;
    }
  );

  // ===========================================================================
  // GET /api/v1/stages/:id/triggers
  // ===========================================================================
  /**
   * Gibt alle verfügbaren Trigger-Aktionen für eine Stage zurück.
   * Enthält auch die aktuell konfigurierten Trigger.
   */
  fastify.get<{
    Params: IdParams;
  }>(
    '/stages/:id/triggers',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Triggers', 'Stages'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              stage_id: { type: 'string' },
              stage_name: { type: 'string' },
              available_actions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    action: { type: 'string' },
                    description: { type: 'string' },
                    required_fields: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  }
                }
              },
              configured_triggers: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true
                }
              }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const parseResult = stageIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Stage-ID', {
          validationErrors: parseResult.error.errors
        });
      }

      const { id: stageId } = parseResult.data;

      // Prüfe ob Stage existiert
      const stage = await db.queryOne<PipelineStage>(
        'SELECT * FROM pipeline_stages WHERE id = $1',
        [stageId]
      );

      if (!stage) {
        throw new NotFoundError('Stage', stageId);
      }

      // Hole verfügbare Aktionen vom TriggerService
      const availableActions = triggerService.getAvailableActions();

      // Hole konfigurierte Trigger aus automation_config
      // Da automation_config ein AutomationStageConfig[] ist, konvertieren wir es
      const configuredTriggers: StageTriggerConfig[] = [];
      
      // Für jetzt geben wir ein leeres Array zurück, da die Struktur anders ist
      // Dies kann später erweitert werden, um AutomationStageConfig zu StageTriggerConfig zu konvertieren
      if (stage.automation_config && Array.isArray(stage.automation_config)) {
        // Hier könnte eine Transformation stattfinden, wenn nötig
      }

      return {
        stage_id: stage.id,
        stage_name: stage.name,
        available_actions: availableActions,
        configured_triggers: configuredTriggers
      };
    }
  );

  // ===========================================================================
  // POST /api/v1/stages/:id/triggers
  // ===========================================================================
  /**
   * Speichert die Trigger-Konfiguration für eine Stage.
   * Überschreibt die bestehende Konfiguration.
   */
  fastify.post<{
    Params: IdParams;
    Body: SaveTriggerConfigBody;
  }>(
    '/stages/:id/triggers',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Triggers', 'Stages'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['triggers'],
          properties: {
            triggers: {
              type: 'array',
              items: {
                type: 'object',
                required: ['action', 'config'],
                properties: {
                  action: {
                    type: 'string',
                    enum: [
                      'send_email',
                      'create_moco_project',
                      'create_moco_customer',
                      'create_moco_offer',
                      'send_cituro_booking',
                      'send_slack_message'
                    ]
                  },
                  name: { type: 'string', maxLength: 255 },
                  description: { type: 'string' },
                  config: {
                    type: 'object',
                    additionalProperties: true
                  },
                  enabled: { type: 'boolean', default: true }
                }
              }
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              stage_id: { type: 'string' },
              triggers_count: { type: 'integer' },
              configured_triggers: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true
                }
              }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const paramResult = stageIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Ungültige Stage-ID', {
          validationErrors: paramResult.error.errors
        });
      }

      const bodyResult = saveTriggerConfigSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Ungültige Trigger-Konfiguration', {
          validationErrors: bodyResult.error.errors
        });
      }

      const { id: stageId } = paramResult.data;
      const { triggers } = bodyResult.data;

      // Prüfe ob Stage existiert
      const stage = await db.queryOne<PipelineStage>(
        'SELECT * FROM pipeline_stages WHERE id = $1',
        [stageId]
      );

      if (!stage) {
        throw new NotFoundError('Stage', stageId);
      }

      // Validiere dass alle Actions gültig sind
      const availableActions = triggerService.getAvailableActions().map(a => a.action);
      for (const trigger of triggers) {
        if (!availableActions.includes(trigger.action)) {
          throw new ValidationError(`Ungültige Aktion: ${trigger.action}`);
        }
      }

      // Speichere Trigger-Konfiguration in automation_config
      await db.execute(
        `UPDATE pipeline_stages 
         SET automation_config = $1
         WHERE id = $2`,
        [JSON.stringify(triggers), stageId]
      );

      request.log.info({
        stageId,
        triggersCount: triggers.length
      }, 'Trigger-Konfiguration gespeichert');

      return {
        success: true,
        stage_id: stageId,
        triggers_count: triggers.length,
        configured_triggers: triggers
      };
    }
  );
}

export default triggersRoutes;
