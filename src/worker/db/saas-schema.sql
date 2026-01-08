-- =============================================================================
-- SAAS MULTITENANCY & LICENSING SYSTEM
-- =============================================================================

-- Tenants table (SaaS customers)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- username+hash for subdomain
  custom_domain TEXT UNIQUE, -- Optional custom domain
  plan TEXT NOT NULL DEFAULT 'free', -- free, pro, enterprise
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, cancelled
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  -- Billing info
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT, -- active, past_due, canceled, incomplete
  trial_ends_at INTEGER
);

-- Plugin licenses for each tenant
CREATE TABLE IF NOT EXISTS plugin_licenses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  plan TEXT NOT NULL, -- free, trial, monthly, yearly, lifetime
  status TEXT NOT NULL DEFAULT 'active', -- active, expired, canceled, trialing
  features TEXT, -- JSON array of enabled features
  expires_at INTEGER,
  trial_used INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  -- Subscription details
  subscription_id TEXT, -- Stripe subscription ID
  price_id TEXT, -- Stripe price ID
  amount INTEGER, -- Price in cents
  currency TEXT DEFAULT 'usd',

  UNIQUE(tenant_id, plugin_id)
);

-- Plugin tiers and feature definitions
CREATE TABLE IF NOT EXISTS plugin_tiers (
  plugin_id TEXT NOT NULL,
  tier_id TEXT NOT NULL, -- free, pro, enterprise
  name TEXT NOT NULL,
  features TEXT NOT NULL, -- JSON array of features
  price_monthly INTEGER, -- Price in cents
  price_yearly INTEGER,
  price_lifetime INTEGER,
  trial_days INTEGER DEFAULT 14,
  PRIMARY KEY (plugin_id, tier_id)
);

-- Feature flags for granular control
CREATE TABLE IF NOT EXISTS plugin_feature_flags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  is_enabled INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  UNIQUE(tenant_id, plugin_id, feature_key)
);

-- Usage tracking for metered billing
CREATE TABLE IF NOT EXISTS plugin_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  metric_name TEXT NOT NULL, -- api_calls, storage, users, etc.
  quantity INTEGER DEFAULT 1,
  period TEXT NOT NULL, -- YYYY-MM for monthly billing
  recorded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Invoices and billing records
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plugin_id TEXT,
  invoice_id TEXT, -- Stripe invoice ID
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL, -- draft, open, paid, void, uncollectible
  due_at INTEGER,
  paid_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain);
CREATE INDEX IF NOT EXISTS idx_plugin_licenses_tenant ON plugin_licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_licenses_plugin ON plugin_licenses(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_licenses_status ON plugin_licenses(status);
CREATE INDEX IF NOT EXISTS idx_plugin_licenses_expires ON plugin_licenses(expires_at);
CREATE INDEX IF NOT EXISTS idx_plugin_feature_flags_tenant ON plugin_feature_flags(tenant_id, plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_usage_tenant_period ON plugin_usage(tenant_id, period);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
