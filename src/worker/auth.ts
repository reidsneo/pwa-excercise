import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "./db/schema";
import type { Env } from "./db";

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface JWTPayload {
	userId: number;
	email: string;
	roleId: number | null;
	tenantId?: string; // 🔥 Security: Include tenant context from login per Cloudflare guide
}

async function getSecretKey(env: Env): Promise<Uint8Array> {
	return new TextEncoder().encode(env.JWT_SECRET);
}

export async function hashPassword(password: string): Promise<string> {
	return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return await bcrypt.compare(password, hash);
}

export async function generateToken(user: User, env: Env, tenantId?: string): Promise<string> {
	const secretKey = await getSecretKey(env);
	const payload: JWTPayload = {
		userId: user.id,
		email: user.email,
		roleId: user.roleId,
		tenantId, // 🔥 Include tenant context from request
	};

	const token = await new SignJWT({ ...payload })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("7d")
		.sign(secretKey);

	return token;
}

export async function verifyToken(token: string, env: Env): Promise<JWTPayload | null> {
	try {
		const secretKey = await getSecretKey(env);
		const { payload } = await jwtVerify(token, secretKey);
		return payload as unknown as JWTPayload;
	} catch {
		return null;
	}
}

export function getSessionExpirationDate(): Date {
	return new Date(Date.now() + SESSION_DURATION);
}

export async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
	const token = getAuthToken(request);
	if (!token) return false;
	const payload = await verifyToken(token, env);
	return !!payload;
}

export function getAuthToken(request: Request): string | null {
	const authHeader = request.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.substring(7);
	}

	// Check cookie
	const cookie = request.headers.get("Cookie");
	const sessionMatch = cookie?.match(/session=([^;]+)/);
	if (sessionMatch) {
		return sessionMatch[1];
	}

	return null;
}

export async function getCurrentUser(request: Request, env: Env): Promise<User | null> {
	const token = getAuthToken(request);
	if (!token) return null;

	const payload = await verifyToken(token, env);
	if (!payload) return null;

	const db = (await import("./db")).createDb(env);
	const user = await (await import("./db")).getUserById(db, payload.userId);

	return user || null;
}

/**
 * 🔥 Create session cookie with wildcard domain support
 * Per Cloudflare guide: Domain=.maindomain.com for subdomain sharing
 */
export function createSessionCookie(token: string, baseDomain?: string): string {
	const domain = baseDomain ? `; Domain=.${baseDomain}` : '';
	return `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax${domain}; Max-Age=${7 * 24 * 60 * 60}`;
}

/**
 * 🔥 Create clear session cookie with wildcard domain support
 */
export function createClearSessionCookie(baseDomain?: string): string {
	const domain = baseDomain ? `; Domain=.${baseDomain}` : '';
	return `session=; Path=/; HttpOnly; Secure; SameSite=Lax${domain}; Max-Age=0`;
}
