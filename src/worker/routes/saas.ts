// =============================================================================
// SAAS API ENDPOINTS
// =============================================================================

import { Hono, Context } from 'hono';
import { validator } from 'hono/validator';
import type { Env } from '../db';
import { verifyToken, getAuthToken } from '../auth';
import {
  createTenant,
  grantLicense,
  revokeLicense,
  getMarketplacePlugins,
  getPluginPricing,
  handleSubscriptionUpdate,
  checkExpiredLicenses,
  trackUsage,
  getUsageStats,
} from '../services/license.service';
import { detectTenant, requireTenant, requirePlugin, requireFeature, type TenantContext, type Tenant, type License, type Variables } from '../middleware/tenant';

type SaaSContext = Context<{ Bindings: Env; Variables: Variables }>;

export function createSaaSRoutes() {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  const publicApp = new Hono<{ Bindings: Env; Variables: Variables }>();
  const adminApp = new Hono<{ Bindings: Env; Variables: Variables }>();

  // ============================================================================
  // PUBLIC ENDPOINTS (No auth required)
  // ============================================================================

  // Get marketplace plugins (with pricing)
  publicApp.get('/marketplace', async (c) => {
    const db = c.env.DB;
    const plugins = await getMarketplacePlugins(db);
    return c.json({ plugins });
  });

  // Get pricing for a specific plugin
  publicApp.get('/marketplace/:pluginId/pricing', async (c) => {
    const db = c.env.DB;
    const pluginId = c.req.param('pluginId');
    const pricing = await getPluginPricing(db, pluginId);
    return c.json(pricing);
  });

  // ============================================================================
  // TENANT ENDPOINTS
  // ============================================================================

  // Get current tenant info
  app.get('/tenant', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) {
      return c.json({ error: 'Tenant not found' }, 404);
    }
    return c.json({ tenant });
  });

  // Get tenant's licenses
  app.get('/licenses', async (c) => {
    const licenses = c.get('licenses') || [];
    return c.json({ licenses });
  });

  // Get licensed plugins list
  app.get('/plugins/enabled', async (c) => {
    const licensedPlugins = c.get('licensedPlugins') || new Set();
    return c.json({ plugins: Array.from(licensedPlugins) });
  });

  // ============================================================================
  // ADMIN ENDPOINTS (Require auth)
  // ============================================================================

  // Create a new tenant account
  adminApp.post('/tenants', validator('json', (value, c) => {
    if (!value.name || !value.email) {
      return c.json({ error: 'Name and email are required' }, 400);
    }
    return value;
  }), async (c) => {
    const db = c.env.DB;
    const data = await c.req.json();

    try {
      const result = await createTenant(db, data);
      return c.json(result, 201);
    } catch (error) {
      return c.json({
        error: 'Failed to create tenant',
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  });

  // Grant a license to a tenant
  adminApp.post('/licenses/grant', async (c) => {
    const db = c.env.DB;
    const data = await c.req.json();

    if (!data.tenantId || !data.pluginId || !data.plan) {
      return c.json({ error: 'tenantId, pluginId, and plan are required' }, 400);
    }

    try {
      const licenseId = await grantLicense(db, data);
      return c.json({ licenseId }, 201);
    } catch (error) {
      return c.json({
        error: 'Failed to grant license',
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  });

  // Revoke a license
  adminApp.post('/licenses/revoke', async (c) => {
    const db = c.env.DB;
    const data = await c.req.json();

    if (!data.tenantId || !data.pluginId) {
      return c.json({ error: 'tenantId and pluginId are required' }, 400);
    }

    try {
      await revokeLicense(db, data.tenantId, data.pluginId);
      return c.json({ success: true });
    } catch (error) {
      return c.json({
        error: 'Failed to revoke license',
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  });

  // Check and update expired licenses (cron job endpoint)
  adminApp.post('/licenses/check-expired', async (c) => {
    const db = c.env.DB;
    const expiredCount = await checkExpiredLicenses(db);
    return c.json({ expiredLicenses: expiredCount });
  });

  // ============================================================================
  // SUBSCRIPTION WEBHOOKS
  // ============================================================================

  // Stripe webhook handler
  adminApp.post('/webhooks/stripe', async (c) => {
    const db = c.env.DB;
    const sig = c.req.header('stripe-signature');
    const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

    if (!sig) {
      return c.json({ error: 'No signature' }, 400);
    }

    // Verify webhook signature (you'd use Stripe SDK here)
    // For now, we'll process it

    try {
      const event = await c.req.json();

      if (event.type === 'customer.subscription.updated' ||
          event.type === 'customer.subscription_deleted') {
        await handleSubscriptionUpdate(db, event.data.object);
      }

      return c.json({ received: true });
    } catch (error) {
      console.error('[Webhook] Error:', error);
      return c.json({ error: 'Webhook processing failed' }, 500);
    }
  });

  // ============================================================================
  // USAGE TRACKING
  // ============================================================================

  // Track plugin usage
  app.post('/usage/track', requirePlugin('*'), async (c) => {
    const db = c.env.DB;
    const data = await c.req.json();
    const tenant = c.get('tenant') as Tenant | null;

    if (!tenant) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    if (!data.pluginId || !data.metricName) {
      return c.json({ error: 'pluginId and metricName are required' }, 400);
    }

    try {
      await trackUsage(
        db,
        tenant.id,
        data.pluginId,
        data.metricName,
        data.quantity || 1
      );
      return c.json({ success: true });
    } catch (error) {
      return c.json({ error: 'Failed to track usage' }, 500);
    }
  });

  // Get usage stats for billing
  app.get('/usage/:period', async (c) => {
    const db = c.env.DB;
    const tenant = c.get('tenant') as Tenant | null;
    const period = c.req.param('period'); // e.g., "2025-01"

    if (!tenant) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    try {
      const stats = await getUsageStats(db, tenant.id, period);
      return c.json({ stats });
    } catch (error) {
      return c.json({ error: 'Failed to get usage stats' }, 500);
    }
  });

  // Mount routes
  app.route('/', publicApp);
  app.route('/admin/saas', adminApp);

  return app;
}
