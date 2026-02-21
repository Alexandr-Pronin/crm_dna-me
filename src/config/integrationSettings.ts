// =============================================================================
// src/config/integrationSettings.ts
// DB-backed integration config (Moco, etc.) with in-memory cache
// =============================================================================

import { db } from '../db/index.js';
import { config } from './index.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const MOCO_KEY = 'moco';

type MocoPayload = {
  subdomain?: string;
  api_key_encrypted?: string;
};

let mocoCache: { apiKey?: string; subdomain?: string } | null = null;

/** Load integration_settings from DB into memory (call at startup / after PUT). */
export async function loadIntegrationSettingsCache(): Promise<void> {
  try {
    const row = await db.queryOne<{ payload: MocoPayload }>(
      `SELECT payload FROM integration_settings WHERE name = $1`,
      [MOCO_KEY]
    );
    if (!row?.payload) {
      mocoCache = null;
      return;
    }
    const p = row.payload as MocoPayload;
    const out: { apiKey?: string; subdomain?: string } = {};
    if (p.subdomain) out.subdomain = p.subdomain;
    if (p.api_key_encrypted) {
      try {
        out.apiKey = decrypt(p.api_key_encrypted);
      } catch {
        // ignore invalid/legacy encrypted value
      }
    }
    mocoCache = Object.keys(out).length ? out : null;
  } catch {
    // Table might not exist yet (migration not run)
    mocoCache = null;
  }
}

/** Sync: get Moco config (cache or env). Used by getMocoService(). */
export function getMocoRuntimeConfig(): { apiKey?: string; subdomain?: string } {
  const fromEnv = {
    apiKey: config.moco.apiKey ?? undefined,
    subdomain: config.moco.subdomain ?? undefined
  };
  if (!mocoCache) return fromEnv;
  return {
    apiKey: mocoCache.apiKey ?? fromEnv.apiKey,
    subdomain: mocoCache.subdomain ?? fromEnv.subdomain
  };
}

/** For API: subdomain + whether API is configured (never return api_key). */
export function getMocoConfigForApi(): { subdomain?: string; api_configured: boolean } {
  const c = getMocoRuntimeConfig();
  return {
    subdomain: c.subdomain,
    api_configured: !!(c.apiKey && c.subdomain)
  };
}

/** Save Moco config (api_key optional; requires ENCRYPTION_KEY if saving api_key). */
export async function setMocoConfig(updates: { api_key?: string; subdomain?: string }): Promise<void> {
  const current = await db.queryOne<{ payload: MocoPayload }>(
    `SELECT payload FROM integration_settings WHERE name = $1`,
    [MOCO_KEY]
  );
  const prev = (current?.payload as MocoPayload) || {};
  const next: MocoPayload = { ...prev };

  if (updates.subdomain !== undefined) next.subdomain = updates.subdomain.trim() || undefined;
  if (updates.api_key !== undefined) {
    if (updates.api_key.trim() === '') {
      next.api_key_encrypted = undefined;
    } else {
      try {
        next.api_key_encrypted = encrypt(updates.api_key.trim());
      } catch (e) {
        throw new Error(
          'API-Key-Verschlüsselung fehlgeschlagen. Bitte ENCRYPTION_KEY in der .env setzen (64 Hex-Zeichen).'
        );
      }
    }
  }

  await db.query(
    `INSERT INTO integration_settings (name, payload, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (name) DO UPDATE SET payload = $2, updated_at = NOW()`,
    [MOCO_KEY, JSON.stringify(next)]
  );
  mocoCache = null;
  await loadIntegrationSettingsCache();
}
