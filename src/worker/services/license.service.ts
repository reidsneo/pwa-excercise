// =============================================================================
// LICENSE & SUBSCRIPTION SERVICE
// =============================================================================

import type { Env } from '../db';

export interface CreateTenantParams {
  name: string;
  email: string;
  plan?: 'free' | 'pro' | 'enterprise';
}

export interface CreateLicenseParams {
  tenantId: string;
  pluginId: string;
  plan: 'free' | 'trial' | 'monthly' | 'yearly' | 'lifetime';
  subscriptionId?: string;
  priceId?: string;
  amount?: number;
  trialDays?: number;
}

export interface SubscriptionTier {
  tier_id: string;
  name: string;
  features: string[];
  price_monthly: number | null;
  price_yearly: number | null;
  price_lifetime: number | null;
  trial_days: number;
}

/**
 * Generate tenant slug from username
 */
function generateTenantSlug(username: string): string {
  const hash = Math.random().toString(36).substring(2, 8);
  return `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${hash}`;
}

/**
 * Create a new tenant (SaaS customer)
 */
export async function createTenant(
  db: any,
  params: CreateTenantParams
): Promise<{ tenantId: string; slug: string }> {
  const tenantId = crypto.randomUUID();
  const slug = generateTenantSlug(params.name);

  // Set trial end date for free plans
  const trialEndsAt = params.plan === 'free'
    ? Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60) // 14 days
    : null;

  await db
    .prepare(`
      INSERT INTO tenants (id, name, slug, plan, status, trial_ends_at)
      VALUES (?, ?, ?, ?, 'active', ?)
    `)
    .bind(tenantId, params.name, slug, params.plan || 'free', trialEndsAt)
    .run();

  return { tenantId, slug };
}

/**
 * Grant a plugin license to a tenant
 */
export async function grantLicense(
  db: any,
  params: CreateLicenseParams
): Promise<string> {
  const licenseId = crypto.randomUUID();

  // Calculate expiration based on plan
  let expiresAt: number | null = null;
  const now = Math.floor(Date.now() / 1000);

  if (params.plan === 'trial') {
    const trialDays = params.trialDays || 14;
    expiresAt = now + (trialDays * 24 * 60 * 60);
  } else if (params.plan === 'monthly') {
    expiresAt = now + (30 * 24 * 60 * 60); // 30 days
  } else if (params.plan === 'yearly') {
    expiresAt = now + (365 * 24 * 60 * 60); // 365 days
  }
  // lifetime and free have no expiration

  // Get plugin tier features
  const tier = await getPluginTier(db, params.pluginId, params.plan);
  const features = tier?.features || [];

  await db
    .prepare(`
      INSERT INTO plugin_licenses (
        id, tenant_id, plugin_id, plan, status, features, expires_at,
        subscription_id, price_id, amount
      )
      VALUES (?, ?, ?, ?, 'trialing', ?, ?, ?, ?, ?)
    `)
    .bind(
      licenseId,
      params.tenantId,
      params.pluginId,
      params.plan,
      JSON.stringify(features),
      expiresAt,
      params.subscriptionId || null,
      params.priceId || null,
      params.amount || null
    )
    .run();

  // Update license status to active after a brief delay
  // (This gives time for payment processing if needed)
  setTimeout(async () => {
    await db
      .prepare(`UPDATE plugin_licenses SET status = 'active' WHERE id = ?`)
      .bind(licenseId)
      .run();
  }, 1000);

  return licenseId;
}

/**
 * Revoke a plugin license
 */
export async function revokeLicense(db: any, tenantId: string, pluginId: string): Promise<void> {
  await db
    .prepare(`
      UPDATE plugin_licenses
      SET status = 'canceled', updated_at = strftime('%s', 'now')
      WHERE tenant_id = ? AND plugin_id = ?
    `)
    .bind(tenantId, pluginId)
    .run();
}

/**
 * Get plugin tier information
 */
export async function getPluginTier(
  db: any,
  pluginId: string,
  tierId: string
): Promise<SubscriptionTier | null> {
  const result = await db
    .prepare(`
      SELECT * FROM plugin_tiers
      WHERE plugin_id = ? AND tier_id = ?
    `)
    .bind(pluginId, tierId)
    .first();

  if (!result) return null;

  return {
    ...result,
    features: JSON.parse(result.features),
  } as SubscriptionTier;
}

/**
 * Check and update expired licenses
 */
export async function checkExpiredLicenses(db: any): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .prepare(`
      UPDATE plugin_licenses
      SET status = 'expired', updated_at = strftime('%s', 'now')
      WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= ?
    `)
    .bind(now)
    .run();

  return result.meta.changes || 0;
}

/**
 * Get all available plugins with pricing tiers
 */
export async function getMarketplacePlugins(db: any): Promise<any[]> {
  const plugins = await db
    .prepare(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.version,
        p.author,
        GROUP_CONCAT(
          JSON_OBJECT(
            'tier_id', pt.tier_id,
            'name', pt.name,
            'features', pt.features,
            'price_monthly', pt.price_monthly,
            'price_yearly', pt.price_yearly,
            'price_lifetime', pt.price_lifetime,
            'trial_days', pt.trial_days
          )
        ) as tiers
      FROM plugins p
      LEFT JOIN plugin_tiers pt ON p.id = pt.plugin_id
      GROUP BY p.id
    `)
    .all();

  return (plugins.results || []).map((plugin: any) => ({
    ...plugin,
    tiers: plugin.tiers ? JSON.parse(`[${plugin.tiers}]`) : [],
  }));
}

/**
 * Get plugin pricing info
 */
export async function getPluginPricing(
  db: any,
  pluginId: string
): Promise<{ tiers: SubscriptionTier[] }> {
  const result = await db
    .prepare(`
      SELECT * FROM plugin_tiers
      WHERE plugin_id = ?
      ORDER BY
        CASE tier_id
          WHEN 'free' THEN 1
          WHEN 'trial' THEN 2
          WHEN 'monthly' THEN 3
          WHEN 'yearly' THEN 4
          WHEN 'lifetime' THEN 5
          ELSE 6
        END
    `)
    .bind(pluginId)
    .all();

  const tiers = (result.results || []).map((row: any) => ({
    tier_id: row.tier_id,
    name: row.name,
    features: JSON.parse(row.features),
    price_monthly: row.price_monthly,
    price_yearly: row.price_yearly,
    price_lifetime: row.price_lifetime,
    trial_days: row.trial_days,
  }));

  return { tiers };
}

/**
 * Handle Stripe webhook for subscription updates
 */
export async function handleSubscriptionUpdate(
  db: any,
  event: any // Stripe.Subscription
): Promise<void> {
  const customerId = event.customer as string;
  const subscriptionId = event.id;
  const status = event.status;

  // Find tenant by Stripe customer ID
  const tenant = await db
    .prepare("SELECT * FROM tenants WHERE stripe_customer_id = ?")
    .bind(customerId)
    .first() as any;

  if (!tenant) {
    console.error('[Subscription] Tenant not found for customer:', customerId);
    return;
  }

  // Update tenant subscription status
  await db
    .prepare(`
      UPDATE tenants
      SET stripe_subscription_id = ?, subscription_status = ?, updated_at = strftime('%s', 'now')
      WHERE id = ?
    `)
    .bind(subscriptionId, status, tenant.id)
    .run();

  // If subscription is canceled, expire all associated licenses
  if (status === 'canceled' || status === 'incomplete_expired') {
    await db
      .prepare(`
        UPDATE plugin_licenses
        SET status = 'expired', updated_at = strftime('%s', 'now')
        WHERE tenant_id = ? AND subscription_id = ?
      `)
      .bind(tenant.id, subscriptionId)
      .run();
  }

  // If subscription is active, ensure licenses are active
  if (status === 'active') {
    await db
      .prepare(`
        UPDATE plugin_licenses
        SET status = 'active', updated_at = strftime('%s', 'now')
        WHERE tenant_id = ? AND subscription_id = ? AND status != 'canceled'
      `)
      .bind(tenant.id, subscriptionId)
      .run();
  }
}

/**
 * Track plugin usage for metered billing
 */
export async function trackUsage(
  db: any,
  tenantId: string,
  pluginId: string,
  metricName: string,
  quantity: number = 1
): Promise<void> {
  const period = new Date().toISOString().substring(0, 7); // YYYY-MM

  await db
    .prepare(`
      INSERT INTO plugin_usage (id, tenant_id, plugin_id, metric_name, quantity, period)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(crypto.randomUUID(), tenantId, pluginId, metricName, quantity, period)
    .run();
}

/**
 * Get usage stats for billing
 */
export async function getUsageStats(
  db: any,
  tenantId: string,
  period: string
): Promise<any[]> {
  const result = await db
    .prepare(`
      SELECT
        plugin_id,
        metric_name,
        SUM(quantity) as total
      FROM plugin_usage
      WHERE tenant_id = ? AND period = ?
      GROUP BY plugin_id, metric_name
    `)
    .bind(tenantId, period)
    .all();

  return result.results || [];
}
