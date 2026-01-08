// =============================================================================
// TENANT DETECTION & MIDDLEWARE
// =============================================================================

import { Context, Next } from 'hono';
import type { Env } from '../db';
import type { Variables } from './types';

export type { Variables } from './types';
export type TenantContext = Context<{ Bindings: Env; Variables: Variables }>;

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  trial_ends_at: number | null;
}

export interface License {
  id: string;
  tenant_id: string;
  plugin_id: string;
  plan: string;
  status: string;
  features: string[];
  expires_at: number | null;
}

/**
 * Extract tenant from subdomain or custom domain
 * Examples:
 * - tenant-name-abc123.maindomain.com -> tenant
 * - tenant-name-abc123.maindomain.com/api/* -> tenant
 * - customdomain.com -> tenant (if mapped)
 */
function extractTenantFromHost(host: string, baseDomain: string): string | null {
  // Remove port if present
  host = host.split(':')[0];

  // Check if it's a custom domain (not base domain)
  if (!host.endsWith(baseDomain)) {
    // This is a custom domain, look up tenant by custom_domain
    return host; // Will be looked up in database
  }

  // Extract subdomain from format: subdomain.baseDomain.com
  const subdomain = host.substring(0, host.length - baseDomain.length - 1);
  if (!subdomain || subdomain === 'www' || subdomain === 'app') {
    return null; // Main domain, no tenant
  }

  return subdomain;
}

/**
 * Get tenant by slug or custom domain
 */
async function getTenantBySlugOrDomain(db: any, slugOrDomain: string): Promise<Tenant | null> {
  try {
    // Try custom domain first
    let result = await db
      .prepare("SELECT * FROM tenants WHERE custom_domain = ? AND status = 'active'")
      .bind(slugOrDomain)
      .first();

    // If not found, try slug
    if (!result) {
      result = await db
        .prepare("SELECT * FROM tenants WHERE slug = ? AND status = 'active'")
        .bind(slugOrDomain)
        .first();
    }

    return result as Tenant | null;
  } catch (error: any) {
    // If table doesn't exist yet, return null
    if (error.message?.includes('no such table')) {
      return null;
    }
    throw error;
  }
}

/**
 * Get all active licenses for a tenant
 */
async function getTenantLicenses(db: any, tenantId: string): Promise<License[]> {
  try {
    const result = await db
      .prepare(`
        SELECT * FROM plugin_licenses
        WHERE tenant_id = ? AND status = 'active'
        AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
      `)
      .bind(tenantId)
      .all();

    return (result.results || []).map((license: any) => ({
      ...license,
      features: license.features ? JSON.parse(license.features) : [],
    }));
  } catch (error: any) {
    // If table doesn't exist yet, return empty array
    if (error.message?.includes('no such table')) {
      return [];
    }
    throw error;
  }
}

/**
 * Check if tenant has a valid license for a plugin
 */
async function hasPluginLicense(db: any, tenantId: string, pluginId: string): Promise<boolean> {
  const license = await db
    .prepare(`
      SELECT 1 FROM plugin_licenses
      WHERE tenant_id = ? AND plugin_id = ? AND status = 'active'
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
      LIMIT 1
    `)
    .bind(tenantId, pluginId)
    .first();

  return !!license;
}

/**
 * Tenant detection middleware
 * Extracts tenant from request and attaches to context
 */
export async function detectTenant(c: TenantContext, next: Next) {
  const host = c.req.header('host') || '';
  const baseDomain = c.env.BASE_DOMAIN || 'localhost:8787';

  const tenantSlug = extractTenantFromHost(host, baseDomain);

  if (tenantSlug) {
    const db = c.env.DB;
    const tenant = await getTenantBySlugOrDomain(db, tenantSlug);

    if (tenant) {
      // Get tenant's licenses
      const licenses = await getTenantLicenses(db, tenant.id);

      // Attach to context
      c.set('tenant', tenant);
      c.set('tenantId', tenant.id);
      c.set('licenses', licenses);
      c.set('licensedPlugins', new Set(licenses.map(l => l.plugin_id)));
    } else {
      // Tenant not found - could return 404 or show error page
      // For now, we'll attach null and let the route handler decide
      c.set('tenant', null);
      c.set('tenantId', null);
      c.set('licenses', []);
      c.set('licensedPlugins', new Set());
    }
  } else {
    // No tenant (main domain)
    c.set('tenant', null);
    c.set('tenantId', null);
    c.set('licenses', []);
    c.set('licensedPlugins', new Set());
  }

  await next();
}

/**
 * Middleware to require a valid tenant
 */
export async function requireTenant(c: TenantContext, next: Next) {
  const tenant = c.get('tenant') as Tenant | null;

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  await next();
}

/**
 * Middleware to require a specific plugin license
 */
export function requirePlugin(pluginId: string) {
  return async (c: TenantContext, next: Next) => {
    const licensedPlugins = c.get('licensedPlugins') as Set<string>;

    if (!licensedPlugins.has(pluginId)) {
      return c.json({
        error: 'Plugin not licensed',
        message: `This feature requires an active subscription for the ${pluginId} plugin.`,
        pluginId
      }, 403);
    }

    await next();
  };
}

/**
 * Check if a specific feature is enabled for a plugin
 */
export async function hasFeature(
  db: any,
  tenantId: string,
  pluginId: string,
  featureKey: string
): Promise<boolean> {
  const flag = await db
    .prepare(`
      SELECT is_enabled FROM plugin_feature_flags
      WHERE tenant_id = ? AND plugin_id = ? AND feature_key = ?
      LIMIT 1
    `)
    .bind(tenantId, pluginId, featureKey)
    .first();

  return flag ? !!flag.is_enabled : false;
}

/**
 * Middleware to require a specific feature flag
 */
export function requireFeature(pluginId: string, featureKey: string) {
  return async (c: TenantContext, next: Next) => {
    const tenant = c.get('tenant') as Tenant | null;
    const licensedPlugins = c.get('licensedPlugins') as Set<string>;

    if (!tenant) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    if (!licensedPlugins.has(pluginId)) {
      return c.json({
        error: 'Plugin not licensed',
        message: `This feature requires the ${pluginId} plugin.`
      }, 403);
    }

    const hasFeatureEnabled = await hasFeature(c.env.DB, tenant.id, pluginId, featureKey);

    if (!hasFeatureEnabled) {
      return c.json({
        error: 'Feature not available',
        message: `This feature requires a higher tier subscription.`,
        pluginId,
        featureKey
      }, 403);
    }

    await next();
  };
}

/**
 * Get license info for a tenant's plugin
 */
export async function getPluginLicense(
  db: any,
  tenantId: string,
  pluginId: string
): Promise<License | null> {
  const result = await db
    .prepare(`
      SELECT * FROM plugin_licenses
      WHERE tenant_id = ? AND plugin_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .bind(tenantId, pluginId)
    .first();

  if (!result) return null;

  return {
    ...result,
    features: result.features ? JSON.parse(result.features) : [],
  } as License;
}
