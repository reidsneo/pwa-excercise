import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { eq } from "drizzle-orm";
import type { Env } from "./db";
import * as db from "./db";
import * as schema from "./db/schema";
import * as auth from "./auth";
import { detectTenant } from "./middleware/tenant";
import type { Variables } from "./middleware/types";

type AppContext = { Bindings: Env; Variables: Variables };

const app = new Hono<AppContext>();

// Middleware
app.use("*", cors());
app.use("*", logger());
app.use("*", detectTenant);

// Initialize plugin registry and register built-in plugins
app.use("/*", async (_, next) => {
  // Initialize the registry if not already initialized
  if (!BackendPluginRegistry.isInitialized()) {
    console.log('[Plugins] Initializing BackendPluginRegistry...');
    // @ts-expect-error - Hono type compatibility issue between registry and app
    await BackendPluginRegistry.initialize(app);
    console.log('[Plugins] BackendPluginRegistry initialized');
  }

  // Ensure blog plugin is registered
  await ensureBlogPluginRegistered();

  await next();
});

// Database initialization on startup
let dbInitialized = false;

async function initializeDatabase(env: Env) {
	if (dbInitialized) return;

	try {
		// Check if we need to initialize by testing if plugins table exists
		// This is the last table we added, so if it exists, all tables should exist
		await env.DB.prepare("SELECT 1 FROM plugins LIMIT 1").first();
		dbInitialized = true;
		return; // All tables exist
	} catch {
		// Tables don't exist, need to initialize
		console.log("Initializing database...");
	}

	// Create tables (using CREATE TABLE IF NOT EXISTS for safety)
	try {
		await env.DB.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role_id INTEGER REFERENCES roles(id), is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS role_permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, UNIQUE(role_id, permission_id));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");

		// 🔥 Multi-tenancy: User-Tenant relationships
		await env.DB.exec("CREATE TABLE IF NOT EXISTS tenant_users (tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL DEFAULT 'member', invited_by INTEGER REFERENCES users(id), joined_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), PRIMARY KEY (tenant_id, user_id));");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON tenant_users(role);");

		// Plugin management tables
		// 🔥 Multi-tenancy: Drop old plugin_states and recreate with tenant_id
		await env.DB.exec("DROP TABLE IF EXISTS plugin_states;");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS plugin_states (tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'installed', version TEXT NOT NULL, enabled_at INTEGER, disabled_at INTEGER, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), PRIMARY KEY (tenant_id, id));");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_plugin_states_tenant ON plugin_states(tenant_id);");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS plugin_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, plugin_id TEXT NOT NULL, version TEXT NOT NULL, applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), UNIQUE(plugin_id, version));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS plugins (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, version TEXT NOT NULL, author TEXT, category TEXT, icon TEXT, featured INTEGER DEFAULT 0, downloads INTEGER DEFAULT 0, rating INTEGER DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");

		// SaaS Multitenancy tables
		await env.DB.exec("CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, custom_domain TEXT UNIQUE, plan TEXT NOT NULL DEFAULT 'free', status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), stripe_customer_id TEXT, stripe_subscription_id TEXT, subscription_status TEXT, trial_ends_at INTEGER);");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS plugin_licenses (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, plugin_id TEXT NOT NULL, plan TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', features TEXT, expires_at INTEGER, trial_used INTEGER DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), subscription_id TEXT, price_id TEXT, amount INTEGER, currency TEXT DEFAULT 'usd', UNIQUE(tenant_id, plugin_id));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS plugin_tiers (plugin_id TEXT NOT NULL, tier_id TEXT NOT NULL, name TEXT NOT NULL, features TEXT NOT NULL, price_monthly INTEGER, price_yearly INTEGER, price_lifetime INTEGER, trial_days INTEGER DEFAULT 14, PRIMARY KEY (plugin_id, tier_id));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS plugin_feature_flags (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, plugin_id TEXT NOT NULL, feature_key TEXT NOT NULL, is_enabled INTEGER DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), UNIQUE(tenant_id, plugin_id, feature_key));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS plugin_usage (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, plugin_id TEXT NOT NULL, metric_name TEXT NOT NULL, quantity INTEGER DEFAULT 1, period TEXT NOT NULL, recorded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, plugin_id TEXT, invoice_id TEXT, amount INTEGER NOT NULL, currency TEXT DEFAULT 'usd', status TEXT NOT NULL, due_at INTEGER, paid_at INTEGER, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");

		// SaaS indexes
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_plugins_featured ON plugins(featured);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_plugin_licenses_tenant ON plugin_licenses(tenant_id);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_plugin_licenses_plugin ON plugin_licenses(plugin_id);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_plugin_licenses_status ON plugin_licenses(status);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_plugin_licenses_expires ON plugin_licenses(expires_at);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_plugin_feature_flags_tenant ON plugin_feature_flags(tenant_id, plugin_id);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_plugin_usage_tenant_period ON plugin_usage(tenant_id, period);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);");
		await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);");

		// Insert default permissions
		await env.DB.exec("INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES ('users.view', 'View users list', 'users', 'view'), ('users.create', 'Create new users', 'users', 'create'), ('users.edit', 'Edit user information', 'users', 'edit'), ('users.delete', 'Delete users', 'users', 'delete'), ('roles.view', 'View roles list', 'roles', 'view'), ('roles.create', 'Create new roles', 'roles', 'create'), ('roles.edit', 'Edit role information', 'roles', 'edit'), ('roles.delete', 'Delete roles', 'roles', 'delete'), ('roles.assign_permissions', 'Assign permissions to roles', 'roles', 'assign_permissions'), ('plugins.view', 'View plugins list', 'plugins', 'view'), ('plugins.install', 'Install plugins', 'plugins', 'install'), ('plugins.enable', 'Enable plugins', 'plugins', 'enable'), ('plugins.disable', 'Disable plugins', 'plugins', 'disable'), ('plugins.uninstall', 'Uninstall plugins', 'plugins', 'uninstall'), ('plugins.configure', 'Configure plugins', 'plugins', 'configure'), ('blog.posts.view', 'View blog posts', 'blog', 'posts.view'), ('blog.posts.create', 'Create blog posts', 'blog', 'posts.create'), ('blog.posts.edit', 'Edit blog posts', 'blog', 'posts.edit'), ('blog.posts.delete', 'Delete blog posts', 'blog', 'posts.delete'), ('blog.posts.publish', 'Publish blog posts', 'blog', 'posts.publish'), ('blog.categories.manage', 'Manage blog categories', 'blog', 'categories.manage'), ('blog.tags.manage', 'Manage blog tags', 'blog', 'tags.manage'), ('blog.settings.manage', 'Manage blog settings', 'blog', 'settings.manage'), ('content.view', 'View content', 'content', 'view'), ('content.create', 'Create content', 'content', 'create'), ('content.edit', 'Edit content', 'content', 'edit'), ('content.delete', 'Delete content', 'content', 'delete'), ('settings.view', 'View settings', 'settings', 'view'), ('settings.edit', 'Edit settings', 'settings', 'edit'), ('analytics.view', 'View analytics', 'analytics', 'view');");

		// Insert default roles
		await env.DB.exec("INSERT OR IGNORE INTO roles (name, description) VALUES ('admin', 'Full system access'), ('user', 'Basic user access'), ('moderator', 'Content moderation access');");

		// Assign all permissions to admin role
		await env.DB.exec("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 1, id FROM permissions;");

		// Assign basic permissions to user role (content.view and content.create)
		await env.DB.exec("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 2, id FROM permissions WHERE name IN ('content.view', 'content.create');");

		// Assign moderator permissions (users.view, content.*)
		await env.DB.exec("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 3, id FROM permissions WHERE name IN ('users.view', 'content.view', 'content.create', 'content.edit', 'content.delete');");

		console.log("Database initialized successfully");
		dbInitialized = true;
	} catch (error) {
		console.error("Failed to initialize database:", error);
		throw error;
	}
}

// Middleware to initialize database
app.use("/*", async (c, next) => {
	await initializeDatabase(c.env);
	await next();
});

// Health check
app.get("/api/", (c) => c.json({ name: "Cloudflare", status: "ok" }));

// Auth routes
app.post("/api/auth/register", async (c) => {
	const { email, password, name, companyName } = await c.req.json();

	if (!email || !password || !name) {
		return c.json({ error: "Email, password, and name are required" }, 400);
	}

	const database = db.createDb(c.env);

	// Check if user already exists
	const existingUser = await db.getUserByEmail(database, email);
	if (existingUser) {
		return c.json({ error: "User already exists" }, 400);
	}

	// Create user with default role (user role)
	const passwordHash = await auth.hashPassword(password);

	// Get or create "user" role
	const [userRole] = await database.select().from(schema.roles).where(eq(schema.roles.name, "user"));

	const newUser = await db.createUser(database, {
		email,
		passwordHash,
		name,
		roleId: userRole?.id || null,
		isActive: true,
	});

	// 🔥 Get tenant from context for JWT
	let tenantId = c.get('tenantId') as string | undefined;

	// 🔥 If no tenant context (main domain), create a new tenant for the user
	if (!tenantId) {
		// Generate a unique tenant slug from company name or email
		const baseSlug = (companyName || name || email.split('@')[0])
			.toLowerCase()
			.trim()
			.replace(/[^\w\s-]/g, '')
			.replace(/[\s_-]+/g, '-')
			.replace(/^-+|-+$/g, '');

		// Ensure slug is unique by appending a random suffix if needed
		let tenantSlug = baseSlug;
		let slugExists = await c.env.DB.prepare("SELECT id FROM tenants WHERE slug = ?").bind(tenantSlug).first();
		let suffix = 1;

		while (slugExists) {
			tenantSlug = `${baseSlug}-${suffix}`;
			slugExists = await c.env.DB.prepare("SELECT id FROM tenants WHERE slug = ?").bind(tenantSlug).first();
			suffix++;
		}

		// Create tenant
		tenantId = crypto.randomUUID();
		const tenantName = companyName || `${name}'s Workspace`;

		await c.env.DB.prepare(`
			INSERT INTO tenants (id, name, slug, plan, status)
			VALUES (?, ?, ?, 'free', 'active')
		`).bind(tenantId, tenantName, tenantSlug).run();

		// Link user to tenant as owner
		await c.env.DB.prepare(`
			INSERT INTO tenant_users (tenant_id, user_id, role, joined_at)
			VALUES (?, ?, 'owner', strftime('%s', 'now'))
		`).bind(tenantId, newUser.id).run();

		// 🔥 Enable blog plugin for new tenant
		const blogPluginId = 'blog';
		await c.env.DB.prepare(`
			INSERT INTO plugin_licenses (id, tenant_id, plugin_id, plan, status, features, created_at)
			VALUES (?, ?, ?, 'free', 'active', '[]', strftime('%s', 'now'))
		`).bind(crypto.randomUUID(), tenantId, blogPluginId).run();
	}

	// Generate token with tenant context
	const token = await auth.generateToken(newUser, c.env, tenantId);

	// Create session
	await db.createSession(database, newUser.id, auth.getSessionExpirationDate());

	// Get tenant slug if tenant was created
	let tenantSlug: string | undefined;
	if (tenantId) {
		const tenant = await c.env.DB.prepare("SELECT slug FROM tenants WHERE id = ?").bind(tenantId).first() as { slug: string } | null;
		tenantSlug = tenant?.slug;
	}

	return c.json({
		user: {
			id: newUser.id,
			email: newUser.email,
			name: newUser.name,
			roleId: newUser.roleId,
		},
		token,
		tenantSlug,
	});
});

app.post("/api/auth/login", async (c) => {
	const { email, password } = await c.req.json();

	if (!email || !password) {
		return c.json({ error: "Email and password are required" }, 400);
	}

	const database = db.createDb(c.env);
	const user = await db.getUserByEmail(database, email);

	if (!user) {
		return c.json({ error: "Invalid credentials" }, 401);
	}

	if (!user.isActive) {
		return c.json({ error: "Account is disabled" }, 403);
	}

	const isValidPassword = await auth.verifyPassword(password, user.passwordHash);
	if (!isValidPassword) {
		return c.json({ error: "Invalid credentials" }, 401);
	}

	// 🔥 Get tenant from context for JWT
	const tenantId = c.get('tenantId') as string | undefined;

	// Generate token with tenant context
	const token = await auth.generateToken(user, c.env, tenantId);

	// Create session
	await db.createSession(database, user.id, auth.getSessionExpirationDate());

	return c.json({
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			roleId: user.roleId,
		},
		token,
	});
});

app.post("/api/auth/logout", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (token) {
		// Verify token and get user ID
		const payload = await auth.verifyToken(token, c.env);
		if (payload) {
			// Note: We'd need to store session ID in JWT for proper session invalidation
			// For now, the client will just remove the token
		}
	}

	return c.json({ success: true });
});

app.get("/api/auth/me", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const payload = await auth.verifyToken(token, c.env);
	if (!payload) {
		return c.json({ error: "Invalid token" }, 401);
	}

	const database = db.createDb(c.env);
	const user = await db.getUserWithRoleAndPermissions(database, payload.userId);

	if (!user) {
		return c.json({ error: "User not found" }, 404);
	}

	// Type guard to check if user has permissions
	const userWithPermissions = 'permissions' in user ? user : null;

	const tenant = c.get('tenant');
	const licenses = c.get('licenses') || [];

	// 🔥 Security: Validate that JWT tenant matches request tenant
	// Prevents cross-tenant token usage
	if (payload.tenantId) {
		const requestTenantId = c.get('tenantId') as string | undefined;

		if (payload.tenantId !== requestTenantId) {
			console.error('Cross-tenant access attempt:', {
				jwtTenantId: payload.tenantId,
				requestTenantId: requestTenantId || 'none',
				userId: payload.userId,
			});
			return c.json({
				error: "Unauthorized",
				message: "This session is not valid for the current workspace. Please login again.",
			}, 403);
		}
	}

	return c.json({
		user: {
			id: user.user.id,
			email: user.user.email,
			name: user.user.name,
			roleId: user.user.roleId,
			role: user.role,
			permissions: userWithPermissions?.permissions || [],
		},
		tenant: tenant ? {
			id: tenant.id,
			name: tenant.name,
			slug: tenant.slug,
			plan: tenant.plan,
			status: tenant.status,
		} : null,
		licenses: licenses,
	});
});

// Plugin licenses API
app.get("/api/plugins/licenses", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const tenant = c.get('tenant');
	const licenses = c.get('licenses') || [];

	if (!tenant) {
		return c.json({
			tenant: null,
			licenses: [],
		});
	}

	return c.json({
		tenant: {
			id: tenant.id,
			name: tenant.name,
			slug: tenant.slug,
			plan: tenant.plan,
			status: tenant.status,
		},
		licenses: licenses,
	});
});

// Admin API routes (require authentication)
app.get("/api/admin/users", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const database = db.createDb(c.env);
	const users = await db.getAllUsers(database);

	return c.json({ users });
});

app.get("/api/admin/roles", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const database = db.createDb(c.env);
	const roles = await db.getAllRoles(database);

	return c.json({ roles });
});

app.post("/api/admin/users", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const { email, password, name, roleId } = await c.req.json();
	const database = db.createDb(c.env);

	const passwordHash = await auth.hashPassword(password);
	const newUser = await db.createUser(database, {
		email,
		passwordHash,
		name,
		roleId: roleId || null,
		isActive: true,
	});

	return c.json({
		user: {
			id: newUser.id,
			email: newUser.email,
			name: newUser.name,
			roleId: newUser.roleId,
		},
	});
});

app.put("/api/admin/users/:id", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const userId = parseInt(c.req.param("id"));
	const { name, roleId, isActive } = await c.req.json();
	const database = db.createDb(c.env);

	const [updatedUser] = await database
		.update(schema.users)
		.set({
			name,
			roleId,
			isActive,
			updatedAt: new Date(),
		})
		.where(eq(schema.users.id, userId))
		.returning();

	return c.json({ user: updatedUser });
});

app.delete("/api/admin/users/:id", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const userId = parseInt(c.req.param("id"));
	const database = db.createDb(c.env);

	await database.delete(schema.users).where(eq(schema.users.id, userId));

	return c.json({ success: true });
});

app.post("/api/admin/roles", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const { name, description } = await c.req.json();
	const database = db.createDb(c.env);

	const newRole = await db.createRole(database, { name, description });

	return c.json({ role: newRole });
});

app.get("/api/admin/roles/:id/permissions", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const roleId = parseInt(c.req.param("id"));
	const database = db.createDb(c.env);

	const permissions = await db.getRolePermissions(database, roleId);

	return c.json({ permissions });
});

app.put("/api/admin/roles/:id", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const roleId = parseInt(c.req.param("id"));
	const { name, description } = await c.req.json();
	const database = db.createDb(c.env);

	const updatedRole = await db.updateRole(database, roleId, { name, description });

	return c.json({ role: updatedRole });
});

app.delete("/api/admin/roles/:id", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const roleId = parseInt(c.req.param("id"));
	const database = db.createDb(c.env);

	await db.deleteRole(database, roleId);

	return c.json({ success: true });
});

app.post("/api/admin/roles/:roleId/permissions", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const roleId = parseInt(c.req.param("roleId"));
	const { permissionId } = await c.req.json();
	const database = db.createDb(c.env);

	await db.assignPermissionToRole(database, roleId, permissionId);

	return c.json({ success: true });
});

app.delete("/api/admin/roles/:roleId/permissions/:permissionId", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const roleId = parseInt(c.req.param("roleId"));
	const permissionId = parseInt(c.req.param("permissionId"));
	const database = db.createDb(c.env);

	await db.removePermissionFromRole(database, roleId, permissionId);

	return c.json({ success: true });
});

app.get("/api/admin/permissions", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const database = db.createDb(c.env);
	const permissions = await db.getAllPermissions(database);

	return c.json({ permissions });
});

// =============================================================================
// BACKEND PLUGIN SYSTEM INTEGRATION
// =============================================================================

// Test route to verify routing is working
app.get("/api/plugins/test", (c) => {
	console.log('[Test Route] ===== HIT =====');
	return c.json({ message: "Plugin routes are working!" });
});

import { BackendPluginRegistry } from "./plugins/BackendPluginRegistry";
import type { PluginId } from "../shared/plugin/index.ts";
import { createBlogRoutes, manifest as blogManifest } from "./plugins/blog";
import { createSaaSRoutes } from "./routes/saas";

// Track if blog plugin has been registered
let blogPluginRegistered = false;

// Register blog plugin with the registry (called after registry is initialized)
async function ensureBlogPluginRegistered() {
  if (blogPluginRegistered) return;

  try {
    console.log('[Plugins] Registering blog plugin with ID:', blogManifest.id);
    const result = await BackendPluginRegistry.register(blogManifest);

    if (result.success) {
      console.log('[Plugins] Blog plugin registered successfully');
      blogPluginRegistered = true;
    } else {
      console.error('[Plugins] Failed to register blog plugin:', result.error);
    }
  } catch (error) {
    console.error('[Plugins] Error registering blog plugin:', error);
  }
}

// Create blog routes
const blogRoutes = createBlogRoutes();

// Create SaaS routes
const saasRoutes = createSaaSRoutes();

// =============================================================================
// API Routes - Plugin Management
// =============================================================================

// Get all plugins
app.get("/api/plugins", async (c) => {
	const plugins = BackendPluginRegistry.getAllPlugins();

	// 🔥 Multi-tenancy: Get plugin states for current tenant only
	const tenantId = c.get('tenantId') as string | undefined;
	const states: Array<{
		id: string;
		status: string;
		version: string;
		enabledAt: number | null;
		disabledAt: number | null;
		createdAt: number;
		updatedAt: number;
	}> = [];

	if (tenantId) {
		// Fetch tenant-specific plugin states from database
		const result = await c.env.DB
			.prepare(`
				SELECT id, status, version, enabled_at, disabled_at, created_at, updated_at
				FROM plugin_states
				WHERE tenant_id = ?
			`)
			.bind(tenantId)
			.all();

		const rows = result.results || [];
		for (const row of rows) {
			states.push({
				id: (row as { id: string }).id,
				status: (row as { status: string }).status,
				version: (row as { version: string }).version,
				enabledAt: (row as { enabled_at: number | null }).enabled_at,
				disabledAt: (row as { disabled_at: number | null }).disabled_at,
				createdAt: (row as { created_at: number }).created_at,
				updatedAt: (row as { updated_at: number }).updated_at,
			});
		}
	}

	return c.json({
		plugins: plugins.map((p) => ({
			id: p.id,
			name: p.name,
			version: p.version,
			description: p.description,
			author: p.author,
		})),
		states: states,
	});
});

// Get plugin by ID
app.get("/api/plugins/:pluginId", async (c) => {
	const pluginId = c.req.param("pluginId");
	const plugin = BackendPluginRegistry.getPlugin(pluginId as PluginId);
	const state = BackendPluginRegistry.getPluginState(pluginId as PluginId);

	if (!plugin) {
		return c.json({ error: "Plugin not found" }, 404);
	}

	return c.json({
		plugin,
		state,
	});
});

// Install plugin
app.post("/api/plugins/install", async (c) => {
	console.log('[Plugin Install] ===== ROUTE HIT =====');
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const { pluginId } = await c.req.json();

	if (!pluginId) {
		return c.json({ error: "pluginId is required" }, 400);
	}

	// 🔥 Multi-tenancy: Get tenant from context
	const tenant = c.get('tenant') as { id: string } | null;
	if (!tenant) {
		return c.json({ error: "Tenant not found" }, 404);
	}
	const tenantId = tenant.id;

	// Check if plugin is already installed for this tenant
	const existing = await c.env.DB
		.prepare("SELECT id FROM plugin_states WHERE tenant_id = ? AND id = ?")
		.bind(tenantId, pluginId)
		.first();

	if (existing) {
		return c.json({ error: "Plugin is already installed" }, 400);
	}

	// Check if plugin is already registered in the BackendPluginRegistry
	let registeredPlugin = BackendPluginRegistry.getPlugin(pluginId as PluginId);

	// If not registered, try to register built-in plugins
	if (!registeredPlugin) {
		console.log(`[Plugin Install] Plugin ${pluginId} not in registry, attempting to register...`);

		// For the blog plugin, re-register it if it's a built-in plugin
		if (pluginId === blogManifest.id) {
			console.log('[Plugin Install] Re-registering built-in blog plugin');
			const result = await BackendPluginRegistry.register(blogManifest);
			if (result.success) {
				registeredPlugin = blogManifest;
				console.log('[Plugin Install] Blog plugin re-registered successfully');
			} else {
				console.error('[Plugin Install] Failed to re-register blog plugin:', result.error);
				return c.json({ error: "Failed to register plugin", details: result.error }, 500);
			}
		} else {
			return c.json({ error: "Plugin not found in registry" }, 404);
		}
	}

	// Add plugin state to database as 'installed' for this tenant
	try {
		await c.env.DB
			.prepare(`
				INSERT INTO plugin_states (tenant_id, id, status, version, updated_at)
				VALUES (?, ?, 'installed', ?, strftime('%s', 'now'))
			`)
			.bind(tenantId, pluginId, registeredPlugin.version)
			.run();

		console.log(`[Plugin Install] Plugin ${pluginId} installed successfully for tenant ${tenantId}`);

		return c.json({ success: true, pluginId, version: registeredPlugin.version });
	} catch (error) {
		console.error('[Plugin Install] Failed to insert plugin state:', error);
		return c.json({ error: "Failed to install plugin", details: error instanceof Error ? error.message : String(error) }, 500);
	}
});

// Enable plugin (using POST body instead of URL param)
app.post("/api/plugins/enable", async (c) => {
	console.log('[Plugin Enable] ===== ROUTE HIT =====');
	console.log('[Plugin Enable] URL:', c.req.url);
	console.log('[Plugin Enable] Method:', c.req.method);

	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		console.log('[Plugin Enable] Auth failed');
		return c.json({ error: "Not authenticated" }, 401);
	}

	const { pluginId } = await c.req.json();
	console.log('[Plugin Enable] Enabling plugin:', pluginId);

	if (!pluginId) {
		return c.json({ error: "pluginId is required" }, 400);
	}

	// 🔥 Multi-tenancy: Get tenant from context
	const tenant = c.get('tenant') as { id: string } | null;
	if (!tenant) {
		return c.json({ error: "Tenant not found" }, 404);
	}
	const tenantId = tenant.id;

	try {
		const result = await BackendPluginRegistry.enable(pluginId as PluginId);
		console.log('[Plugin Enable] Result:', result);

		if (!result.success) {
			console.log('[Plugin Enable] FAILED:', result.error);
			return c.json({ error: result.error }, 400);
		}

		// Run migrations when plugin is enabled
		try {
			await runPluginMigrations(pluginId, c.env);
		} catch (migrationError) {
			console.error('[Plugin Enable] Migration failed:', migrationError);
			// Rollback the enable operation
			await BackendPluginRegistry.disable(pluginId as PluginId);
			return c.json({ error: `Migration failed: ${migrationError instanceof Error ? migrationError.message : String(migrationError)}` }, 500);
		}

		// Update plugin state in database for this tenant
		const plugin = BackendPluginRegistry.getPlugin(pluginId as PluginId);
		await c.env.DB
			.prepare(`
				INSERT OR REPLACE INTO plugin_states (tenant_id, id, status, version, enabled_at, disabled_at, updated_at)
				VALUES (?, ?, 'enabled', ?, strftime('%s', 'now'), NULL, strftime('%s', 'now'))
			`)
			.bind(tenantId, pluginId, plugin?.version || '1.0.0')
			.run();

		console.log('[Plugin Enable] SUCCESS');
		return c.json({ success: true });
	} catch (error) {
		console.error('[Plugin Enable] Unexpected error:', error);
		return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
	}
});

// Disable plugin (using POST body instead of URL param)
app.post("/api/plugins/disable", async (c) => {
	console.log('[Plugin Disable] ===== ROUTE HIT =====');
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const { pluginId } = await c.req.json();
	console.log('[Plugin Disable] Disabling plugin:', pluginId);

	if (!pluginId) {
		return c.json({ error: "pluginId is required" }, 400);
	}

	// 🔥 Multi-tenancy: Get tenant from context
	const tenant = c.get('tenant') as { id: string } | null;
	if (!tenant) {
		return c.json({ error: "Tenant not found" }, 404);
	}
	const tenantId = tenant.id;

	const result = await BackendPluginRegistry.disable(pluginId as PluginId);

	if (result.success) {
		// Update plugin state in database for this tenant
		const plugin = BackendPluginRegistry.getPlugin(pluginId as PluginId);
		await c.env.DB
			.prepare(`
				INSERT OR REPLACE INTO plugin_states (tenant_id, id, status, version, disabled_at, updated_at)
				VALUES (?, ?, 'disabled', ?, strftime('%s', 'now'), strftime('%s', 'now'))
			`)
			.bind(tenantId, pluginId, plugin?.version || '1.0.0')
			.run();

		console.log('[Plugin Disable] SUCCESS');
		return c.json({ success: true });
	}

	console.log('[Plugin Disable] FAILED:', result.error);
	return c.json({ error: result.error }, 400);
});

// Uninstall plugin (using POST body instead of URL param)
app.post("/api/plugins/uninstall", async (c) => {
	console.log('[Plugin Uninstall] ===== ROUTE HIT =====');
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const { pluginId } = await c.req.json();
	console.log('[Plugin Uninstall] Uninstalling plugin:', pluginId);

	if (!pluginId) {
		return c.json({ error: "pluginId is required" }, 400);
	}

	// Get tenant from context
	const tenant = c.get('tenant');
	if (!tenant) {
		return c.json({ error: "Tenant not found" }, 404);
	}

	const tenantId = tenant.id;
	console.log('[Plugin Uninstall] Tenant ID:', tenantId);

	// Delete tenant-specific data for this plugin
	try {
		if (pluginId === '550e8400-e29b-41d4-a716-446655440001') {
			// Blog plugin - delete all tenant-specific blog data
			console.log('[Plugin Uninstall] Deleting blog data for tenant:', tenantId);

			// Delete in correct order due to foreign key constraints
			await c.env.DB.prepare("DELETE FROM blog_post_tags WHERE tenant_id = ?").bind(tenantId).run();
			await c.env.DB.prepare("DELETE FROM blog_post_categories WHERE tenant_id = ?").bind(tenantId).run();
			await c.env.DB.prepare("DELETE FROM blog_posts WHERE tenant_id = ?").bind(tenantId).run();
			await c.env.DB.prepare("DELETE FROM blog_tags WHERE tenant_id = ?").bind(tenantId).run();
			await c.env.DB.prepare("DELETE FROM blog_categories WHERE tenant_id = ?").bind(tenantId).run();

			console.log('[Plugin Uninstall] Deleted blog data for tenant:', tenantId);
		}

		// Remove plugin license for this tenant
		await c.env.DB
			.prepare("DELETE FROM plugin_licenses WHERE tenant_id = ? AND plugin_id = ?")
			.bind(tenantId, pluginId)
			.run();

		// 🔥 Multi-tenancy: Delete plugin state for this tenant only
		await c.env.DB
			.prepare("DELETE FROM plugin_states WHERE tenant_id = ? AND id = ?")
			.bind(tenantId, pluginId)
			.run();

		// Check if any tenant still has this plugin installed
		const remainingStates = await c.env.DB
			.prepare("SELECT COUNT(*) as count FROM plugin_states WHERE id = ?")
			.bind(pluginId)
			.first();

		const remainingCount = (remainingStates?.count as number) || 0;

		if (remainingCount === 0) {
			// No tenants have this plugin installed, clean up tables and unregister
			console.log('[Plugin Uninstall] No remaining tenants, cleaning up plugin');

			// Run rollback migrations to drop tables
			await rollbackPluginMigrations(pluginId, c.env);

			// Unregister plugin from registry
			await BackendPluginRegistry.unregister(pluginId as PluginId);
		} else {
			console.log(`[Plugin Uninstall] ${remainingCount} tenant(s) still have this plugin installed`);
		}

		console.log('[Plugin Uninstall] SUCCESS');
		return c.json({ success: true });
	} catch (error) {
		console.error('[Plugin Uninstall] Error:', error);
		return c.json({ error: "Failed to uninstall plugin" }, 500);
	}
});

// Seed blog sample data (development helper)
app.post("/api/blog/seed", async (c) => {
	console.log('[Blog Seed] Seeding blog sample data...');

	const db = c.env.DB;

	try {
		// Insert sample categories
		await db.prepare(`
			INSERT OR IGNORE INTO blog_categories (name, slug, description) VALUES
			('Technology', 'technology', 'Latest tech news and insights'),
			('Programming', 'programming', 'Coding tutorials and best practices'),
			('Web Development', 'web-development', 'Frontend and backend development tips')
		`).run();

		// Insert sample tags
		await db.prepare(`
			INSERT OR IGNORE INTO blog_tags (name, slug) VALUES
			('JavaScript', 'javascript'),
			('TypeScript', 'typescript'),
			('React', 'react'),
			('Cloudflare', 'cloudflare'),
			('Tutorial', 'tutorial')
		`).run();

		// Insert sample posts
		await db.prepare(`
			INSERT OR IGNORE INTO blog_posts (title, slug, content, excerpt, author_id, status, published_at) VALUES
			(
				'Getting Started with Cloudflare Workers',
				'getting-started-with-cloudflare-workers',
				'Cloudflare Workers allow you to run JavaScript at the edge, closer to your users worldwide. In this tutorial, we''ll explore the basics of building serverless applications with Workers.

You''ll learn how to:
- Set up your development environment
- Create your first Worker
- Deploy to the Cloudflare network
- Handle HTTP requests and responses

Let''s dive in and start building edge applications!',
				'Learn how to build serverless applications with Cloudflare Workers',
				1,
				'published',
				strftime('%s', 'now', '-7 days')
			),
			(
				'TypeScript Best Practices for 2025',
				'typescript-best-practices-2025',
				'TypeScript has become the de facto standard for building large-scale JavaScript applications. Here are the best practices you should follow in 2025:

1. Use strict mode
2. Leverage type inference
3. Avoid any types
4. Use utility types
5. Implement proper error handling

These practices will help you write more maintainable and type-safe code.',
				'Modern TypeScript practices for better code quality',
				1,
				'published',
				strftime('%s', 'now', '-5 days')
			),
			(
				'Building a Plugin System with React',
				'building-plugin-system-with-react',
				'Plugin architectures enable extensibility and modularity in your applications. In this guide, we''ll build a dynamic plugin system using React.

Key concepts covered:
- Plugin registry pattern
- Dynamic component loading
- Lifecycle management
- Communication between plugins

Let''s create a flexible plugin system that scales with your application.',
				'Create a flexible and scalable plugin architecture',
				1,
				'published',
				strftime('%s', 'now', '-3 days')
			)
		`).run();

		// Link posts with categories
		await db.prepare(`
			INSERT OR IGNORE INTO blog_post_categories (post_id, category_id)
			SELECT p.id, c.id FROM blog_posts p
			CROSS JOIN blog_categories c
			WHERE (p.slug = 'getting-started-with-cloudflare-workers' AND c.slug = 'technology')
			   OR (p.slug = 'typescript-best-practices-2025' AND c.slug = 'programming')
			   OR (p.slug = 'building-plugin-system-with-react' AND c.slug = 'web-development')
		`).run();

		// Link posts with tags
		await db.prepare(`
			INSERT OR IGNORE INTO blog_post_tags (post_id, tag_id)
			SELECT p.id, t.id FROM blog_posts p
			CROSS JOIN blog_tags t
			WHERE (p.slug = 'getting-started-with-cloudflare-workers' AND t.slug IN ('cloudflare', 'tutorial'))
			   OR (p.slug = 'typescript-best-practices-2025' AND t.slug IN ('typescript', 'javascript'))
			   OR (p.slug = 'building-plugin-system-with-react' AND t.slug IN ('react', 'tutorial'))
		`).run();

		console.log('[Blog Seed] Sample data seeded successfully');
		return c.json({ success: true, message: 'Blog sample data seeded successfully' });
	} catch (error) {
		console.error('[Blog Seed] Error seeding data:', error);
		return c.json({ error: 'Failed to seed blog data', details: error instanceof Error ? error.message : String(error) }, 500);
	}
});

// Seed plugin tier data (development helper)
app.post("/api/saas/seed-tiers", async (c) => {
	console.log('[SaaS Seed] Seeding plugin tier data...');

	const db = c.env.DB;

	try {
		// Insert plugin tiers for blog plugin
		await db.prepare(`
			INSERT OR REPLACE INTO plugin_tiers (plugin_id, tier_id, name, features, price_monthly, price_yearly, price_lifetime, trial_days) VALUES
			(
				'blog',
				'free',
				'Blog Free',
				'["posts.view", "posts.create", "posts.edit", "categories.view", "tags.view"]',
				0,
				NULL,
				NULL,
				0
			),
			(
				'blog',
				'trial',
				'Blog Trial',
				'["posts.view", "posts.create", "posts.edit", "posts.delete", "posts.publish", "categories.manage", "tags.manage", "settings.manage"]',
				NULL,
				NULL,
				NULL,
				14
			),
			(
				'blog',
				'monthly',
				'Blog Pro Monthly',
				'["posts.view", "posts.create", "posts.edit", "posts.delete", "posts.publish", "categories.manage", "tags.manage", "settings.manage", "analytics.view"]',
				999,
				NULL,
				NULL,
				0
			),
			(
				'blog',
				'yearly',
				'Blog Pro Yearly',
				'["posts.view", "posts.create", "posts.edit", "posts.delete", "posts.publish", "categories.manage", "tags.manage", "settings.manage", "analytics.view"]',
				NULL,
				9999,
				NULL,
				0
			),
			(
				'blog',
				'lifetime',
				'Blog Lifetime',
				'["posts.view", "posts.create", "posts.edit", "posts.delete", "posts.publish", "categories.manage", "tags.manage", "settings.manage", "analytics.view"]',
				NULL,
				NULL,
				49999,
				0
			)
		`).run();

		console.log('[SaaS Seed] Plugin tier data seeded successfully');
		return c.json({ success: true, message: 'Plugin tier data seeded successfully' });
	} catch (error) {
		console.error('[SaaS Seed] Error seeding tier data:', error);
		return c.json({ error: 'Failed to seed plugin tier data', details: error instanceof Error ? error.message : String(error) }, 500);
	}
});

// Create a sample tenant (development helper)
app.post("/api/saas/seed-tenant", async (c) => {
	console.log('[SaaS Seed] Creating sample tenant...');

	const db = c.env.DB;
	const { name } = await c.req.json();

	try {
		const tenantId = crypto.randomUUID();
		const hash = Math.random().toString(36).substring(2, 8);
		const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${hash}`;

		// Create tenant
		await db.prepare(`
			INSERT INTO tenants (id, name, slug, plan, status, trial_ends_at)
			VALUES (?, ?, ?, 'free', 'active', strftime('%s', 'now') + 14 * 24 * 60 * 60)
		`).bind(tenantId, name, slug).run();

		// Grant free blog license
		await db.prepare(`
			INSERT INTO plugin_licenses (id, tenant_id, plugin_id, plan, status, features)
			VALUES (?, ?, 'blog', 'free', 'active', '["posts.view", "posts.create", "posts.edit", "categories.view", "tags.view"]')
		`).bind(crypto.randomUUID(), tenantId).run();

		console.log('[SaaS Seed] Sample tenant created successfully');
		return c.json({ success: true, message: 'Sample tenant created', tenantId, slug });
	} catch (error) {
		console.error('[SaaS Seed] Error creating tenant:', error);
		return c.json({ error: 'Failed to create tenant', details: error instanceof Error ? error.message : String(error) }, 500);
	}
});

// Seed plugin marketplace data (development helper)
app.post("/api/saas/seed-plugins", async (c) => {
	console.log('[SaaS Seed] Seeding plugin marketplace data...');

	const db = c.env.DB;

	try {
		// Insert blog plugin to marketplace
		await db.prepare(`
			INSERT OR REPLACE INTO plugins (id, name, description, version, author, category, icon, featured, downloads, rating)
			VALUES (
				'550e8400-e29b-41d4-a716-446655440001',
				'Blog Plugin',
				'Full-featured blog with posts, categories, tags, and powerful publishing tools. Perfect for content creators and businesses.',
				'1.1.0',
				'System',
				'content',
				'📝',
				1,
				0,
				5
			)
		`).run();

		console.log('[SaaS Seed] Plugin marketplace data seeded successfully');
		return c.json({ success: true, message: 'Plugin marketplace data seeded successfully' });
	} catch (error) {
		console.error('[SaaS Seed] Error seeding plugin data:', error);
		return c.json({ error: 'Failed to seed plugin data', details: error instanceof Error ? error.message : String(error) }, 500);
	}
});

// Delete all database tables and start fresh (DANGEROUS - development only!)
app.delete("/api/initialize", async (c) => {
	console.log('[Initialize] 🗑️  DELETING ALL DATABASE TABLES...');

	const db = c.env.DB;

	try {
		// Get all tables
		const tables = await db.prepare(`
			SELECT name FROM sqlite_master
			WHERE type='table' AND name NOT LIKE 'sqlite_%'
		`).all();

		const tableNames = (tables.results || []).map((t) => (t as { name: string }).name);

		// Drop all tables
		for (const tableName of tableNames) {
			console.log(`[Initialize] Dropping table: ${tableName}`);
			await db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run();
		}

		console.log('[Initialize] ✅ All tables deleted successfully');
		return c.json({
			success: true,
			message: `Deleted ${tableNames.length} tables`,
			tables: tableNames
		});
	} catch (error) {
		console.error('[Initialize] Error deleting tables:', error);
		return c.json({
			error: 'Failed to delete tables',
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// Initialize all database and run migrations (development helper)
app.post("/api/initialize", async (c) => {
	console.log('[Initialize] Starting full initialization...');

	const db = c.env.DB;

	try {
		// Step 1: Initialize core database tables
		await initializeDatabase(c.env);

		// Step 1.5: Create default/master tenant
		console.log('[Initialize] Creating default tenant...');
		const defaultTenantId = 'default';
		const defaultTenantExists = await db.prepare("SELECT id FROM tenants WHERE id = ?").bind(defaultTenantId).first();

		if (!defaultTenantExists) {
			await db.prepare(`
				INSERT INTO tenants (id, name, slug, plan, status)
				VALUES (?, 'Master Workspace', 'default', 'premium', 'active')
			`).bind(defaultTenantId).run();
			console.log('[Initialize] Default tenant created');
		}

		// Step 1.6: Create default admin accounts for master tenant and tenant-2
		console.log('[Initialize] Creating default admin accounts...');
		const importAuth = await import('bcryptjs');
		const bcrypt = importAuth.default || importAuth;

		// Create admin account for master tenant (default)
		const masterAdminEmail = 'admin@localhost.dev';
		const masterAdminExists = await db.prepare("SELECT id FROM users WHERE email = ?").bind(masterAdminEmail).first();

		if (!masterAdminExists) {
			const masterAdminPassword = await bcrypt.hash('admin123', 10);

			// Create the admin user with role_id = 1 (id is auto-increment)
			await db.prepare(`
				INSERT INTO users (email, password_hash, name, role_id, is_active, created_at, updated_at)
				VALUES (?, ?, ?, 1, 1, strftime('%s', 'now'), strftime('%s', 'now'))
			`).bind(masterAdminEmail, masterAdminPassword, 'Master Admin').run();

			// Get the auto-generated user id and link to default tenant
			const userIdResult = await db.prepare("SELECT id FROM users WHERE email = ?").bind(masterAdminEmail).first() as { id: number } | null;
			if (userIdResult) {
				await db.prepare(`
					INSERT INTO tenant_users (tenant_id, user_id, role, joined_at)
					VALUES (?, ?, 'owner', strftime('%s', 'now'))
				`).bind(defaultTenantId, userIdResult.id).run();
			}

			console.log('[Initialize] Master admin account created:', masterAdminEmail);
		}

		// Create tenant-2 if it doesn't exist
		const tenant2Slug = 'tenant-2';
		const tenant2Exists = await db.prepare("SELECT id FROM tenants WHERE slug = ?").bind(tenant2Slug).first() as { id: string } | null;

		let tenant2Id: string;
		if (!tenant2Exists) {
			tenant2Id = crypto.randomUUID();
			await db.prepare(`
				INSERT INTO tenants (id, name, slug, plan, status)
				VALUES (?, 'Tenant 2 Workspace', 'tenant-2', 'free', 'active')
			`).bind(tenant2Id).run();
			console.log('[Initialize] Tenant-2 created');
		} else {
			tenant2Id = tenant2Exists.id;
		}

		// Create admin account for tenant-2
		const tenant2AdminEmail = 'admin@tenant-2.dev';
		const tenant2AdminExists = await db.prepare("SELECT id FROM users WHERE email = ?").bind(tenant2AdminEmail).first();

		if (!tenant2AdminExists) {
			const tenant2AdminPassword = await bcrypt.hash('admin123', 10);

			// Create the admin user with role_id = 1 (id is auto-increment)
			await db.prepare(`
				INSERT INTO users (email, password_hash, name, role_id, is_active, created_at, updated_at)
				VALUES (?, ?, ?, 1, 1, strftime('%s', 'now'), strftime('%s', 'now'))
			`).bind(tenant2AdminEmail, tenant2AdminPassword, 'Tenant 2 Admin').run();

			// Get the auto-generated user id and link to tenant-2
			const tenant2UserResult = await db.prepare("SELECT id FROM users WHERE email = ?").bind(tenant2AdminEmail).first() as { id: number } | null;
			if (tenant2UserResult) {
				await db.prepare(`
					INSERT INTO tenant_users (tenant_id, user_id, role, joined_at)
					VALUES (?, ?, 'owner', strftime('%s', 'now'))
				`).bind(tenant2Id, tenant2UserResult.id).run();
			}

			console.log('[Initialize] Tenant-2 admin account created:', tenant2AdminEmail);
		}

		// Step 2: Seed plugin marketplace
		console.log('[Initialize] Seeding plugin marketplace...');
		await db.prepare(`
			INSERT OR REPLACE INTO plugins (id, name, description, version, author, category, icon, featured, downloads, rating)
			VALUES (
				'550e8400-e29b-41d4-a716-446655440001',
				'Blog Plugin',
				'Full-featured blog with posts, categories, tags, and powerful publishing tools. Perfect for content creators and businesses.',
				'1.1.0',
				'System',
				'content',
				'📝',
				1,
				0,
				5
			)
		`).run();

		// Step 3: Seed plugin tiers
		console.log('[Initialize] Seeding plugin tiers...');
		const blogPluginId = '550e8400-e29b-41d4-a716-446655440001';
		await db.prepare(`
			INSERT OR REPLACE INTO plugin_tiers (plugin_id, tier_id, name, features, price_monthly, price_yearly, price_lifetime, trial_days) VALUES
			(
				?,
				'free',
				'Blog Free',
				'["posts.view", "posts.create", "posts.edit", "posts.delete", "posts.publish", "categories.manage", "tags.manage", "settings.manage", "analytics.view"]',
				0,
				NULL,
				NULL,
				0
			)
		`).bind(blogPluginId).run();

		// Step 4: Register and enable blog plugin with migrations
		console.log('[Initialize] Registering and enabling blog plugin...');

		// Register the plugin
		await BackendPluginRegistry.register(blogManifest);

		// Run migrations
		await runPluginMigrations(blogPluginId, c.env);

		// Enable the plugin
		await BackendPluginRegistry.enable(blogPluginId);

		console.log('[Initialize] Full initialization completed successfully');
		return c.json({
			success: true,
			message: 'Database initialized, marketplace seeded, tiers created, and blog plugin enabled with migrations'
		});
	} catch (error) {
		console.error('[Initialize] Error during initialization:', error);
		return c.json({
			error: 'Initialization failed',
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// Mount blog routes AFTER plugin management routes
app.route('/', blogRoutes);

// Mount SaaS routes
app.route('/api/saas', saasRoutes);

// Migration Runner
interface PluginMigrationState {
	version: string;
	appliedAt: string;
}

async function getPluginMigrationStates(env: Env): Promise<Map<string, PluginMigrationState[]>> {
	const states = new Map<string, PluginMigrationState[]>();

	try {
		const result = await env.DB
			.prepare("SELECT plugin_id, version, applied_at FROM plugin_migrations ORDER BY applied_at")
			.all();

		for (const row of (result.results || [])) {
			const pluginId = row.plugin_id as string;
			const version = row.version as string;
			const appliedAt = row.applied_at as string;
			if (!states.has(pluginId)) {
				states.set(pluginId, []);
			}
			states.get(pluginId)!.push({
				version,
				appliedAt,
			});
		}
	} catch {
		// Table doesn't exist yet, will be created
	}

	return states;
}

async function runPluginMigrations(pluginId: string, env: Env): Promise<boolean> {
	const plugin = BackendPluginRegistry.getPlugin(pluginId as PluginId);
	if (!plugin?.migrations) return false;

	// Ensure plugin_migrations table exists
	try {
		await env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS plugin_migrations (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				plugin_id TEXT NOT NULL,
				version TEXT NOT NULL,
				applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
				UNIQUE(plugin_id, version)
			)
		`).run();
	} catch (error) {
		console.warn('[Migration] Failed to create plugin_migrations table (may already exist):', error);
	}

	const appliedStates = await getPluginMigrationStates(env);
	const appliedVersions = new Set(
		(appliedStates.get(pluginId) || []).map((s) => s.version)
	);

	for (const migration of plugin.migrations) {
		if (appliedVersions.has(migration.version)) {
			console.log(`[Migration] Plugin ${pluginId} version ${migration.version} already applied`);
			continue;
		}

		console.log(`[Migration] Applying ${pluginId} version ${migration.version}: ${migration.name}`);

		try {
			// Parse SQL statements more carefully to handle complex migrations
			// This function handles:
			// - Multi-line CREATE TABLE statements
			// - Semicolons inside string literals or function calls
			// - Comments (-- style)
			const statements = parseSqlStatements(migration.up);

			for (const statement of statements) {
				try {
					await env.DB.prepare(statement).run();
				} catch (stmtError) {
					console.error(`[Migration] Failed to execute statement:`, statement.substring(0, 200));
					throw stmtError;
				}
			}

			// Record migration
			await env.DB
				.prepare("INSERT INTO plugin_migrations (plugin_id, version) VALUES (?, ?)")
				.bind(pluginId, migration.version)
				.run();

			console.log(`[Migration] Successfully applied ${pluginId} version ${migration.version}`);
		} catch (error) {
			console.error(`[Migration] Failed to apply ${pluginId} version ${migration.version}:`, error);
			throw error; // Re-throw to fail the entire operation
		}
	}

	return true;
}

/**
 * Parse SQL statements from a migration script
 * Handles complex SQL with semicolons in string literals and function calls
 */
function parseSqlStatements(sql: string): string[] {
	const statements: string[] = [];
	let current = '';
	let inString = false;
	let stringChar = '';
	let inComment = false;
	let parenDepth = 0;

	for (let i = 0; i < sql.length; i++) {
		const char = sql[i];
		const nextChar = sql[i + 1] || '';

		// Handle comments
		if (!inString && !inComment && char === '-' && nextChar === '-') {
			inComment = true;
			i++; // Skip next character
			continue;
		}

		if (inComment && char === '\n') {
			inComment = false;
			current += char;
			continue;
		}

		if (inComment) {
			continue;
		}

		// Handle string literals
		if (!inComment && (char === '"' || char === "'" || char === '`')) {
			if (!inString) {
				inString = true;
				stringChar = char;
			} else if (char === stringChar) {
				inString = false;
				stringChar = '';
			}
		}

		// Track parentheses for CREATE TABLE statements
		if (!inString && !inComment) {
			if (char === '(') parenDepth++;
			if (char === ')') parenDepth--;
		}

		// Accumulate current statement
		current += char;

		// Check for statement terminator (semicolon not in string/comment, with parenDepth 0)
		if (char === ';' && !inString && !inComment && parenDepth === 0) {
			const trimmed = current.trim();
			if (trimmed.length > 0) {
				statements.push(trimmed);
			}
			current = '';
		}
	}

	// Add remaining content
	const trimmed = current.trim();
	if (trimmed.length > 0) {
		statements.push(trimmed);
	}

	return statements;
}

async function rollbackPluginMigrations(pluginId: string, env: Env): Promise<boolean> {
	const plugin = BackendPluginRegistry.getPlugin(pluginId as PluginId);
	if (!plugin?.migrations) return false;

	const appliedStates = await getPluginMigrationStates(env);
	const appliedVersions = (appliedStates.get(pluginId) || []).map((s) => s.version);

	// Rollback in reverse order
	for (let i = plugin.migrations.length - 1; i >= 0; i--) {
		const migration = plugin.migrations[i];

		if (!appliedVersions.includes(migration.version)) {
			continue;
		}

		console.log(`[Migration] Rolling back ${pluginId} version ${migration.version}: ${migration.name}`);

		try {
			// Parse SQL statements to handle semicolons in string literals correctly
			const statements = parseSqlStatements(migration.down);

			// Execute each statement individually
			for (const statement of statements) {
				await env.DB.exec(statement);
			}

			// Remove migration record
			await env.DB
				.prepare("DELETE FROM plugin_migrations WHERE plugin_id = ? AND version = ?")
				.bind(pluginId, migration.version)
				.run();

			console.log(`[Migration] Successfully rolled back ${pluginId} version ${migration.version}`);
		} catch (error) {
			console.error(`[Migration] Failed to rollback ${pluginId} version ${migration.version}:`, error);
			// Continue with other migrations even if one fails
		}
	}

	return true;
}

// Middleware to initialize plugins on first request
// Note: Disabled for now - use manual initialization if needed
// let pluginsInitialized = false;
// let pluginsInitializing = false;
// app.use("/*", async (c, next) => {
// 	if (!pluginsInitialized && !pluginsInitializing) {
// 		pluginsInitializing = true;
// 		try {
// 			await initializePlugins(app, c.env);
// 			pluginsInitialized = true;
// 		} catch (error) {
// 			console.error('[Plugins] Failed to initialize:', error);
// 		} finally {
// 			pluginsInitializing = false;
// 		}
// 	}
// 	await next();
// });

export default app;
