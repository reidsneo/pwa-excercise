import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "./schema";

export interface Env {
	DB: D1Database;
	JWT_SECRET: string;
}

export function createDb(env: Env) {
	return drizzle(env.DB, { schema });
}

export async function getUserByEmail(db: ReturnType<typeof createDb>, email: string) {
	const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
	return user;
}

export async function getUserById(db: ReturnType<typeof createDb>, id: number) {
	const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
	return user;
}

export async function getUserWithRole(db: ReturnType<typeof createDb>, userId: number) {
	const [user] = await db
		.select({
			user: schema.users,
			role: schema.roles,
		})
		.from(schema.users)
		.leftJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
		.where(eq(schema.users.id, userId));

	return user;
}

export async function getUserWithRoleAndPermissions(db: ReturnType<typeof createDb>, userId: number) {
	const userWithRole = await getUserWithRole(db, userId);
	if (!userWithRole || !userWithRole.role) {
		return userWithRole;
	}

	// Get permissions for this role
	const permissions = await db
		.select({
			permission: schema.permissions,
		})
		.from(schema.rolePermissions)
		.innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
		.where(eq(schema.rolePermissions.roleId, userWithRole.role.id));

	return {
		...userWithRole,
		permissions: permissions.map((p) => p.permission),
	};
}

export async function createUser(db: ReturnType<typeof createDb>, data: schema.NewUser) {
	const [user] = await db.insert(schema.users).values(data).returning();
	return user;
}

export async function createSession(db: ReturnType<typeof createDb>, userId: number, expiresAt: Date) {
	const sessionId = crypto.randomUUID();
	const [session] = await db
		.insert(schema.sessions)
		.values({
			id: sessionId,
			userId,
			expiresAt,
		})
		.returning();

	return session;
}

export async function getSession(db: ReturnType<typeof createDb>, sessionId: string) {
	const now = new Date();
	const [session] = await db
		.select()
		.from(schema.sessions)
		.where(and(eq(schema.sessions.id, sessionId), sql`${schema.sessions.expiresAt} > ${now.getTime()}`));

	return session;
}

export async function deleteSession(db: ReturnType<typeof createDb>, sessionId: string) {
	await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function getAllUsers(db: ReturnType<typeof createDb>) {
	return await db
		.select({
			user: schema.users,
			role: schema.roles,
		})
		.from(schema.users)
		.leftJoin(schema.roles, eq(schema.users.roleId, schema.roles.id));
}

export async function getAllRoles(db: ReturnType<typeof createDb>) {
	return await db.select().from(schema.roles);
}

export async function getAllPermissions(db: ReturnType<typeof createDb>) {
	return await db.select().from(schema.permissions);
}

export async function getRolePermissions(db: ReturnType<typeof createDb>, roleId: number) {
	const permissions = await db
		.select({
			permission: schema.permissions,
		})
		.from(schema.rolePermissions)
		.innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
		.where(eq(schema.rolePermissions.roleId, roleId));

	return permissions.map((p) => p.permission);
}

export async function createRole(db: ReturnType<typeof createDb>, data: schema.NewRole) {
	const [role] = await db.insert(schema.roles).values(data).returning();
	return role;
}

export async function updateRole(db: ReturnType<typeof createDb>, roleId: number, data: Partial<schema.NewRole>) {
	const [role] = await db.update(schema.roles).set(data).where(eq(schema.roles.id, roleId)).returning();
	return role;
}

export async function deleteRole(db: ReturnType<typeof createDb>, roleId: number) {
	await db.delete(schema.roles).where(eq(schema.roles.id, roleId));
}

export async function assignPermissionToRole(db: ReturnType<typeof createDb>, roleId: number, permissionId: number) {
	await db.insert(schema.rolePermissions).values({
		roleId,
		permissionId,
	});
}

export async function removePermissionFromRole(db: ReturnType<typeof createDb>, roleId: number, permissionId: number) {
	await db
		.delete(schema.rolePermissions)
		.where(and(eq(schema.rolePermissions.roleId, roleId), eq(schema.rolePermissions.permissionId, permissionId)));
}
