// =============================================================================
// HONO CONTEXT EXTENSIONS
// =============================================================================
// Extend Hono's Context to include tenant and user properties
// =============================================================================

import type { Context } from 'hono';
import type { Tenant } from './middleware/tenant';

declare module 'hono' {
  interface ContextVariableMap {
    tenant?: Tenant;
    user?: {
      id: number;
      email: string;
      name: string;
      roleId?: number;
    };
  }
}
