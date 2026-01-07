import { Context, Next } from 'hono';
import { verifyToken } from '../auth';

/**
 * Middleware to verify JWT authentication and attach user to context
 */
export async function verifyAuth(c: Context<any, any>, next: Next) {
  const token = getAuthToken(c.req.raw);

  if (!token) {
    (c as any).set('user', null);
    (c as any).set('isAuthenticated', false);
    return next();
  }

  const payload = await verifyToken(token, c.env);
  if (!payload) {
    (c as any).set('user', null);
    (c as any).set('isAuthenticated', false);
    return next();
  }

  // Get full user object
  const db = (await import('../db')).createDb(c.env);
  const user = await (await import('../db')).getUserById(db, payload.userId);

  (c as any).set('user', user || null);
  (c as any).set('isAuthenticated', !!user);

  await next();
}

/**
 * Middleware to require authentication - returns 401 if not authenticated
 */
export async function requireAuth(c: Context<any, any>, next: Next) {
  const isAuthenticated = (c as any).get('isAuthenticated');
  const user = (c as any).get('user');

  if (!isAuthenticated || !user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  await next();
}

/**
 * Middleware to require admin role - returns 403 if not admin
 */
export async function requireAdmin(c: Context<any, any>, next: Next) {
  const user = (c as any).get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user has admin role (roleId = 1)
  if (user.roleId !== 1) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  await next();
}

function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie
  const cookie = request.headers.get('Cookie');
  const sessionMatch = cookie?.match(/session=([^;]+)/);
  if (sessionMatch) {
    return sessionMatch[1];
  }

  return null;
}
