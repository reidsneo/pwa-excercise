import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	email: text("email").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	name: text("name").notNull(),
	roleId: integer("role_id").references(() => roles.id),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const roles = sqliteTable("roles", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	description: text("description"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const permissions = sqliteTable("permissions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	description: text("description"),
	resource: text("resource").notNull(), // e.g., "users", "roles", "content"
	action: text("action").notNull(), // e.g., "create", "read", "update", "delete"
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const rolePermissions = sqliteTable("role_permissions", {
	roleId: integer("role_id")
		.notNull()
		.references(() => roles.id, { onDelete: "cascade" }),
	permissionId: integer("permission_id")
		.notNull()
		.references(() => permissions.id, { onDelete: "cascade" }),
});

export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// 🔥 Multi-tenancy: Junction table for user-tenant relationships
// Allows users to belong to multiple tenants with different roles per tenant
export const tenantUsers = sqliteTable("tenant_users", {
	tenantId: text("tenant_id").notNull(), // FK enforced at DB level
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	role: text("role").notNull().default("member"), // "owner", "admin", "member", etc.
	invitedBy: integer("invited_by").references(() => users.id),
	joinedAt: integer("joined_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type TenantUser = typeof tenantUsers.$inferSelect;
export type NewTenantUser = typeof tenantUsers.$inferInsert;

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
