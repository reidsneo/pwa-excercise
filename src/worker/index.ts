import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { eq } from "drizzle-orm";
import type { Env } from "./db";
import * as db from "./db";
import * as schema from "./db/schema";
import * as auth from "./auth";

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Database initialization on startup
let dbInitialized = false;

async function initializeDatabase(env: Env) {
	if (dbInitialized) return;

	try {
		const database = db.createDb(env);

		// Check if tables exist by trying to query users table
		await database.select().from(schema.users).limit(1);
		dbInitialized = true;
	} catch {
		// Tables don't exist, need to initialize
		console.log("Initializing database...");

		// Create tables
		await env.DB.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role_id INTEGER REFERENCES roles(id), is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS role_permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, UNIQUE(role_id, permission_id));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");

		// Plugin management tables
		await env.DB.exec("CREATE TABLE IF NOT EXISTS plugin_states (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'installed', version TEXT NOT NULL, enabled_at INTEGER, disabled_at INTEGER, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')));");
		await env.DB.exec("CREATE TABLE IF NOT EXISTS plugin_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, plugin_id TEXT NOT NULL, version TEXT NOT NULL, applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), UNIQUE(plugin_id, version));");

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
	const { email, password, name } = await c.req.json();

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

	// Generate token
	const token = await auth.generateToken(newUser, c.env);

	// Create session
	await db.createSession(database, newUser.id, auth.getSessionExpirationDate());

	return c.json({
		user: {
			id: newUser.id,
			email: newUser.email,
			name: newUser.name,
			roleId: newUser.roleId,
		},
		token,
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

	// Generate token
	const token = await auth.generateToken(user, c.env);

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

	return c.json({
		user: {
			id: user.user.id,
			email: user.user.email,
			name: user.user.name,
			roleId: user.user.roleId,
			role: user.role,
			permissions: userWithPermissions?.permissions || [],
		},
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

import { BackendPluginRegistry } from "./plugins/BackendPluginRegistry";
import { createBlogRoutes } from "./plugins/blog";

// Mount blog routes directly
app.route('/', createBlogRoutes());

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
	} catch (error) {
		// Table doesn't exist yet, will be created
	}

	return states;
}

async function runPluginMigrations(pluginId: string, env: Env): Promise<boolean> {
	const plugin = BackendPluginRegistry.getPlugin(pluginId as `${string}/${string}`);
	if (!plugin?.migrations) return false;

	// Ensure plugin_migrations table exists
	await env.DB.exec(`
		CREATE TABLE IF NOT EXISTS plugin_migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			plugin_id TEXT NOT NULL,
			version TEXT NOT NULL,
			applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
			UNIQUE(plugin_id, version)
		)
	`);

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
			// Run up migration
			for (const statement of migration.up.split(';').filter((s) => s.trim())) {
				if (statement.trim()) {
					await env.DB.exec(statement.trim());
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
			return false;
		}
	}

	return true;
}

async function rollbackPluginMigrations(pluginId: string, env: Env): Promise<boolean> {
	const plugin = BackendPluginRegistry.getPlugin(pluginId as `${string}/${string}`);
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
			// Run down migration
			for (const statement of migration.down.split(';').filter((s) => s.trim())) {
				if (statement.trim()) {
					await env.DB.exec(statement.trim());
				}
			}

			// Remove migration record
			await env.DB
				.prepare("DELETE FROM plugin_migrations WHERE plugin_id = ? AND version = ?")
				.bind(pluginId, migration.version)
				.run();

			console.log(`[Migration] Successfully rolled back ${pluginId} version ${migration.version}`);
		} catch (error) {
			console.error(`[Migration] Failed to rollback ${pluginId} version ${migration.version}:`, error);
			return false;
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

// Plugin management API endpoints
app.post("/api/plugins/:pluginId/install", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const pluginId = c.req.param("pluginId");

	// Check if plugin is already installed
	const existing = await c.env.DB
		.prepare("SELECT id FROM plugin_states WHERE id = ?")
		.bind(pluginId)
		.first();

	if (existing) {
		return c.json({ error: "Plugin is already installed" }, 400);
	}

	// Register the plugin
	const result = await BackendPluginRegistry.register(
		BackendPluginRegistry.getPlugin(pluginId as `${string}/${string}`)!
	);

	if (result.success) {
		// Add plugin state to database as 'installed'
		await c.env.DB
			.prepare(`
				INSERT INTO plugin_states (id, status, version, updated_at)
				VALUES (?, 'installed', '1.0.0', strftime('%s', 'now'))
			`)
			.bind(pluginId)
			.run();

		return c.json({ success: true });
	}

	return c.json({ error: result.error || "Failed to install plugin" }, 400);
});

app.post("/api/plugins/:pluginId/enable", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const pluginId = c.req.param("pluginId");
	const result = await BackendPluginRegistry.enable(pluginId as any);

	if (result.success) {
		// Run migrations when plugin is enabled
		await runPluginMigrations(pluginId, c.env);

		// Update plugin state in database
		await c.env.DB
			.prepare(`
				INSERT OR REPLACE INTO plugin_states (id, status, enabled_at, disabled_at, updated_at)
				VALUES (?, 'enabled', strftime('%s', 'now'), NULL, strftime('%s', 'now'))
			`)
			.bind(pluginId)
			.run();

		return c.json({ success: true });
	}

	return c.json({ error: result.error }, 400);
});

app.post("/api/plugins/:pluginId/disable", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const pluginId = c.req.param("pluginId");
	const result = await BackendPluginRegistry.disable(pluginId as any);

	if (result.success) {
		// Update plugin state in database
		await c.env.DB
			.prepare(`
				INSERT OR REPLACE INTO plugin_states (id, status, disabled_at, updated_at)
				VALUES (?, 'disabled', strftime('%s', 'now'), strftime('%s', 'now'))
			`)
			.bind(pluginId)
			.run();

		return c.json({ success: true });
	}

	return c.json({ error: result.error }, 400);
});

app.delete("/api/plugins/:pluginId/uninstall", async (c) => {
	const token = auth.getAuthToken(c.req.raw);
	if (!token || !(await auth.verifyToken(token, c.env))) {
		return c.json({ error: "Not authenticated" }, 401);
	}

	const pluginId = c.req.param("pluginId");

	// Rollback migrations before uninstalling
	await rollbackPluginMigrations(pluginId, c.env);

	await BackendPluginRegistry.unregister(pluginId as any);

	// Remove plugin state from database
	await c.env.DB
		.prepare("DELETE FROM plugin_states WHERE id = ?")
		.bind(pluginId)
		.run();

	return c.json({ success: true });
});

export default app;
