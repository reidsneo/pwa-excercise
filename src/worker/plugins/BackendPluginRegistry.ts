// =============================================================================
// BACKEND PLUGIN REGISTRY - HONO
// =============================================================================
// Server-side plugin management for Hono applications
// =============================================================================

import type {
  PluginId,
  BackendPluginManifest,
  PluginState,
  PluginLoadResult,
  PluginEvent,
} from '@/shared/plugin';
import { PluginStatus, PluginEventType } from '@/shared/plugin';

// -----------------------------------------------------------------------------
// Hono Type Imports
// -----------------------------------------------------------------------------

import type { Hono } from 'hono';
import type { Context } from 'hono';

// -----------------------------------------------------------------------------
// Backend Plugin Registry
// -----------------------------------------------------------------------------

type BackendPluginEventListener = (event: PluginEvent) => void;

class BackendPluginEventEmitter {
  private listeners: Map<string, Set<BackendPluginEventListener>> = new Map();

  on(type: PluginEventType, listener: BackendPluginEventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  emit(event: PluginEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach((listener) => listener(event));
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

class BackendPluginRegistryImpl {
  private plugins: Map<PluginId, BackendPluginManifest> = new Map();
  private pluginStates: Map<PluginId, PluginState> = new Map();
  private eventEmitter = new BackendPluginEventEmitter();
  private loadOrder: PluginId[] = [];
  private initialized = false;
  private honoApp: Hono | null = null;

  /**
   * Initialize the backend plugin registry
   */
  async initialize(honoApp: Hono): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.honoApp = honoApp;

    // Load plugin states from storage (D1)
    await this.loadPluginStates();

    this.initialized = true;
  }

  /**
   * Register a backend plugin
   */
  async register(manifest: BackendPluginManifest): Promise<PluginLoadResult> {
    // Validate plugin
    const validation = this.validatePlugin(manifest);
    if (!validation.valid) {
      return {
        id: manifest.id,
        success: false,
        error: validation.error,
      };
    }

    // Check for conflicts
    const conflictCheck = this.checkConflicts(manifest);
    if (!conflictCheck.valid) {
      return {
        id: manifest.id,
        success: false,
        error: conflictCheck.error,
      };
    }

    // Check dependencies
    const depCheck = this.checkDependencies(manifest);
    if (!depCheck.valid) {
      return {
        id: manifest.id,
        success: false,
        error: depCheck.error,
      };
    }

    // Register the plugin
    this.plugins.set(manifest.id, manifest);

    // Initialize state if not exists
    if (!this.pluginStates.has(manifest.id)) {
      this.pluginStates.set(manifest.id, {
        id: manifest.id,
        status: PluginStatus.INSTALLED,
        version: manifest.version,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Update load order
    this.updateLoadOrder(manifest);

    // Register API endpoints if Hono app is available
    if (this.honoApp && manifest.endpoints) {
      this.registerEndpoints(manifest);
    }

    // Register middleware
    if (this.honoApp && manifest.middleware) {
      this.registerMiddleware(manifest);
    }

    // Register scheduled tasks
    if (manifest.scheduledTasks) {
      this.registerScheduledTasks(manifest);
    }

    // Register webhooks
    if (manifest.webhooks) {
      this.registerWebhooks(manifest);
    }

    // Emit loaded event
    this.emitEvent({
      type: PluginEventType.LOADED,
      pluginId: manifest.id,
      timestamp: new Date().toISOString(),
    });

    // Call onLoad hook
    if (manifest.onLoad) {
      try {
        await manifest.onLoad();
      } catch (error) {
        console.error(`Error in onLoad for plugin ${manifest.id}:`, error);
        return {
          id: manifest.id,
          success: false,
          error: `onLoad hook failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return {
      id: manifest.id,
      success: true,
    };
  }

  /**
   * Unregister a backend plugin
   */
  async unregister(pluginId: PluginId): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    // Call onUninstall hook
    if (plugin.onUninstall) {
      try {
        await plugin.onUninstall();
      } catch (error) {
        console.error(`Error in onUninstall for plugin ${pluginId}:`, error);
      }
    }

    // Remove from registry
    this.plugins.delete(pluginId);
    this.pluginStates.delete(pluginId);
    this.loadOrder = this.loadOrder.filter((id) => id !== pluginId);

    // TODO: Unregister API endpoints from Hono app

    // Emit uninstall event
    this.emitEvent({
      type: PluginEventType.UNINSTALLED,
      pluginId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Enable a backend plugin
   */
  async enable(pluginId: PluginId): Promise<PluginLoadResult> {
    const plugin = this.plugins.get(pluginId);
    const state = this.pluginStates.get(pluginId);

    if (!plugin || !state) {
      return {
        id: pluginId,
        success: false,
        error: 'Plugin not found',
      };
    }

    if (state.status === PluginStatus.ENABLED) {
      return {
        id: pluginId,
        success: true,
      };
    }

    // Run migrations if present
    if (plugin.migrations && plugin.migrations.length > 0) {
      // TODO: Implement migration runner
      console.log(`Running migrations for plugin ${pluginId}`);
    }

    // Call onEnable hook
    if (plugin.onEnable) {
      try {
        await plugin.onEnable();
      } catch (error) {
        console.error(`Error in onEnable for plugin ${pluginId}:`, error);
        this.updatePluginState(pluginId, {
          status: PluginStatus.ERROR,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          id: pluginId,
          success: false,
          error: `onEnable hook failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // Update state
    this.updatePluginState(pluginId, {
      status: PluginStatus.ENABLED,
    });

    // Emit enabled event
    this.emitEvent({
      type: PluginEventType.ENABLED,
      pluginId,
      timestamp: new Date().toISOString(),
    });

    return {
      id: pluginId,
      success: true,
    };
  }

  /**
   * Disable a backend plugin
   */
  async disable(pluginId: PluginId): Promise<PluginLoadResult> {
    const plugin = this.plugins.get(pluginId);
    const state = this.pluginStates.get(pluginId);

    if (!plugin || !state) {
      return {
        id: pluginId,
        success: false,
        error: 'Plugin not found',
      };
    }

    if (state.status === PluginStatus.DISABLED) {
      return {
        id: pluginId,
        success: true,
      };
    }

    // Check if other plugins depend on this one
    const dependents = this.getDependents(pluginId);
    if (dependents.length > 0) {
      return {
        id: pluginId,
        success: false,
        error: `Cannot disable: required by ${dependents.join(', ')}`,
      };
    }

    // Call onDisable hook
    if (plugin.onDisable) {
      try {
        await plugin.onDisable();
      } catch (error) {
        console.error(`Error in onDisable for plugin ${pluginId}:`, error);
        return {
          id: pluginId,
          success: false,
          error: `onDisable hook failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // Update state
    this.updatePluginState(pluginId, {
      status: PluginStatus.DISABLED,
    });

    // Emit disabled event
    this.emitEvent({
      type: PluginEventType.DISABLED,
      pluginId,
      timestamp: new Date().toISOString(),
    });

    return {
      id: pluginId,
      success: true,
    };
  }

  /**
   * Get a plugin manifest
   */
  getPlugin(pluginId: PluginId): BackendPluginManifest | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get a plugin state
   */
  getPluginState(pluginId: PluginId): PluginState | undefined {
    return this.pluginStates.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): BackendPluginManifest[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all plugin states
   */
  getAllPluginStates(): PluginState[] {
    return Array.from(this.pluginStates.values());
  }

  /**
   * Get enabled plugins only
   */
  getEnabledPlugins(): BackendPluginManifest[] {
    return this.getAllPlugins().filter((plugin) => {
      const state = this.pluginStates.get(plugin.id);
      return state?.status === 'enabled';
    });
  }

  /**
   * Update plugin configuration
   */
  updatePluginConfig(pluginId: PluginId, config: Record<string, unknown>): void {
    const state = this.pluginStates.get(pluginId);
    if (state) {
      state.config = { ...state.config, ...config };
      this.savePluginStates();

      this.emitEvent({
        type: PluginEventType.SETTINGS_CHANGED,
        pluginId,
        data: { config },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Listen to plugin events
   */
  on(type: PluginEventType, listener: BackendPluginEventListener): () => void {
    return this.eventEmitter.on(type, listener);
  }

  /**
   * Get load order
   */
  getLoadOrder(): PluginId[] {
    return [...this.loadOrder];
  }

  // ----- Private Methods -----

  private validatePlugin(manifest: BackendPluginManifest): { valid: boolean; error?: string } {
    if (!manifest.id) {
      return { valid: false, error: 'Plugin ID is required' };
    }

    if (!manifest.name) {
      return { valid: false, error: 'Plugin name is required' };
    }

    if (!manifest.version) {
      return { valid: false, error: 'Plugin version is required' };
    }

    // Validate UUID format (optional but recommended)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(manifest.id)) {
      console.warn(`Plugin ID "${manifest.id}" is not a valid UUID format. Recommended to use UUIDs.`);
    }

    return { valid: true };
  }

  private checkConflicts(manifest: BackendPluginManifest): { valid: boolean; error?: string } {
    if (manifest.conflicts) {
      for (const conflictId of manifest.conflicts) {
        if (this.plugins.has(conflictId)) {
          return {
            valid: false,
            error: `Conflicts with installed plugin: ${conflictId}`,
          };
        }
      }
    }

    for (const [, plugin] of this.plugins) {
      if (plugin.conflicts?.includes(manifest.id)) {
        return {
          valid: false,
          error: `Plugin ${plugin.id} declares conflict with this plugin`,
        };
      }
    }

    return { valid: true };
  }

  private checkDependencies(manifest: BackendPluginManifest): { valid: boolean; error?: string } {
    if (!manifest.dependencies) {
      return { valid: true };
    }

    for (const dep of manifest.dependencies) {
      const depPlugin = this.plugins.get(dep.pluginId);
      if (!depPlugin) {
        return {
          valid: false,
          error: `Missing dependency: ${dep.pluginId}`,
        };
      }

      if (dep.minVersion && !this.satisfiesVersion(depPlugin.version, dep.minVersion, 'gte')) {
        return {
          valid: false,
          error: `Dependency ${dep.pluginId} requires version >= ${dep.minVersion}, found ${depPlugin.version}`,
        };
      }
    }

    return { valid: true };
  }

  private satisfiesVersion(version: string, constraint: string, operator: 'gte' | 'lte'): boolean {
    const v1 = version.split('.').map(Number);
    const v2 = constraint.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const a = v1[i] ?? 0;
      const b = v2[i] ?? 0;
      if (operator === 'gte' && a > b) return true;
      if (operator === 'lte' && a < b) return true;
      if (a !== b) return operator === 'gte' ? a > b : a < b;
    }
    return true;
  }

  private getDependents(pluginId: PluginId): PluginId[] {
    const dependents: PluginId[] = [];

    for (const [, plugin] of this.plugins) {
      if (plugin.dependencies?.some((dep: { pluginId: PluginId }) => dep.pluginId === pluginId)) {
        dependents.push(plugin.id);
      }
    }

    return dependents;
  }

  private updateLoadOrder(manifest: BackendPluginManifest): void {
    const priority = manifest.priority ?? 0;
    let inserted = false;

    for (let i = 0; i < this.loadOrder.length; i++) {
      const existingPlugin = this.plugins.get(this.loadOrder[i]);
      if (existingPlugin && (existingPlugin.priority ?? 0) < priority) {
        this.loadOrder.splice(i, 0, manifest.id);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.loadOrder.push(manifest.id);
    }
  }

  private updatePluginState(pluginId: PluginId, updates: Partial<PluginState>): void {
    const state = this.pluginStates.get(pluginId);
    if (state) {
      Object.assign(state, updates);
      state.updatedAt = new Date().toISOString();
      this.savePluginStates();
    }
  }

  private emitEvent(event: PluginEvent): void {
    this.eventEmitter.emit(event);
  }

  private registerEndpoints(manifest: BackendPluginManifest): void {
    if (!this.honoApp || !manifest.endpoints) {
      return;
    }

    // Register each endpoint
    for (const endpoint of manifest.endpoints) {
      // Use plugin name instead of ID for URL routing
      const fullPath = `/api/plugins/${manifest.name}${endpoint.path}`;

      // TODO: Register route with Hono app
      // This requires handler functions to be part of the endpoint definition
      console.log(`Registered endpoint: ${endpoint.method} ${fullPath}`);
    }
  }

  private registerMiddleware(manifest: BackendPluginManifest): void {
    if (!this.honoApp || !manifest.middleware) {
      return;
    }

    // TODO: Register middleware with Hono app
    console.log(`Registering middleware for plugin ${manifest.id}`);
  }

  private registerScheduledTasks(manifest: BackendPluginManifest): void {
    // TODO: Integrate with Cloudflare Workers Cron Triggers
    console.log(`Registering ${manifest.scheduledTasks?.length || 0} scheduled tasks for plugin ${manifest.id}`);
  }

  private registerWebhooks(manifest: BackendPluginManifest): void {
    // TODO: Register webhook handlers
    console.log(`Registering ${manifest.webhooks?.length || 0} webhooks for plugin ${manifest.id}`);
  }

  private async loadPluginStates(): Promise<void> {
    // TODO: Load from D1 database
    // For now, use empty map
    console.log('Loading plugin states from storage...');
  }

  private savePluginStates(): void {
    // TODO: Save to D1 database
    console.log('Saving plugin states to storage...');
  }

  /**
   * Reset the registry
   */
  reset(): void {
    this.plugins.clear();
    this.pluginStates.clear();
    this.loadOrder = [];
    this.eventEmitter.clear();
    this.initialized = false;
    this.honoApp = null;
  }
}

// -----------------------------------------------------------------------------
// Singleton Instance
// -----------------------------------------------------------------------------

export const BackendPluginRegistry = new BackendPluginRegistryImpl();

// -----------------------------------------------------------------------------
// Hono Middleware
// -----------------------------------------------------------------------------

/**
 * Middleware to check if a plugin is enabled
 */
export function pluginEnabled(pluginId: PluginId) {
  return async (c: Context, next: () => Promise<void>) => {
    const state = BackendPluginRegistry.getPluginState(pluginId);

    if (!state || state.status !== 'enabled') {
      return c.json({ error: 'Plugin is not enabled' }, 403);
    }

    await next();
  };
}

/**
 * Middleware to check plugin permission
 */
export function requirePluginPermission(pluginId: PluginId, _permission: string) {
  return async (c: Context, next: () => Promise<void>) => {
    // First check if plugin is enabled
    const state = BackendPluginRegistry.getPluginState(pluginId);
    if (!state || state.status !== 'enabled') {
      return c.json({ error: 'Plugin is not enabled' }, 403);
    }

    // TODO: Check user's permission for this plugin
    // This requires integrating with the auth system

    await next();
  };
}
