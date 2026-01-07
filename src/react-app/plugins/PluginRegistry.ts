// =============================================================================
// PLUGIN REGISTRY - FRONTEND
// =============================================================================
// Central registry for managing loaded plugins
// =============================================================================

import type {
  PluginId,
  PluginManifest,
  PluginState,
  PluginRoute,
  PluginNavigationItem,
  PluginComponent,
  PluginSettingsPanel,
  PluginEvent,
  PluginLoadResult,
} from '@/shared/plugin';
import { PluginStatus, PluginEventType } from '@/shared/plugin';

// -----------------------------------------------------------------------------
// Event Emitter for Plugin Events
// -----------------------------------------------------------------------------

type PluginEventListener = (event: PluginEvent) => void;

class PluginEventEmitter {
  private listeners: Map<string, Set<PluginEventListener>> = new Map();

  on(type: PluginEventType, listener: PluginEventListener): () => void {
    const typeStr = type as string;
    if (!this.listeners.has(typeStr)) {
      this.listeners.set(typeStr, new Set());
    }
    this.listeners.get(typeStr)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(typeStr)?.delete(listener);
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

// -----------------------------------------------------------------------------
// Plugin Registry Class
// -----------------------------------------------------------------------------

class PluginRegistryImpl {
  // ----- State -----
  private plugins: Map<PluginId, PluginManifest> = new Map();
  private pluginStates: Map<PluginId, PluginState> = new Map();
  private eventEmitter = new PluginEventEmitter();
  private loadOrder: PluginId[] = [];
  private initialized = false;

  // ----- Public API -----

  /**
   * Initialize the plugin registry
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load plugin states from storage
    await this.loadPluginStates();

    this.initialized = true;
  }

  /**
   * Register a plugin
   */
  async register(manifest: PluginManifest): Promise<PluginLoadResult> {
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
   * Unregister a plugin
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

    // Emit uninstall event
    this.emitEvent({
      type: PluginEventType.UNINSTALLED,
      pluginId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Enable a plugin
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
   * Disable a plugin
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
  getPlugin(pluginId: PluginId): PluginManifest | undefined {
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
  getAllPlugins(): PluginManifest[] {
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
  getEnabledPlugins(): PluginManifest[] {
    return this.getAllPlugins().filter((plugin) => {
      const state = this.pluginStates.get(plugin.id);
      return state?.status === PluginStatus.ENABLED;
    });
  }

  /**
   * Get all routes from enabled plugins
   */
  getPluginRoutes(): PluginRoute[] {
    const routes: PluginRoute[] = [];
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.routes) {
        routes.push(...plugin.routes);
      }
    }
    return routes;
  }

  /**
   * Get navigation items for a specific scope
   */
  getNavigationItems(scope: 'main' | 'admin' | 'user'): PluginNavigationItem[] {
    const items: PluginNavigationItem[] = [];
    const navKey = scope === 'main' ? 'navigation' : `${scope}Navigation`;

    for (const plugin of this.getEnabledPlugins()) {
      const pluginNav = plugin[navKey as keyof PluginManifest] as PluginNavigationItem[] | undefined;
      if (pluginNav) {
        items.push(...pluginNav);
      }
    }

    // Sort by order
    return items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  /**
   * Get component injections for a specific slot
   */
  getComponentsForSlot(slot: string): PluginComponent[] {
    const components: PluginComponent[] = [];

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.components) {
        const slotComponents = plugin.components.filter((c) => c.slot === slot);
        components.push(...slotComponents);
      }
    }

    return components;
  }

  /**
   * Get settings panels from enabled plugins
   */
  getSettingsPanels(): PluginSettingsPanel[] {
    const panels: PluginSettingsPanel[] = [];

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.settings) {
        panels.push(plugin.settings);
      }
    }

    return panels.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
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
  on(type: PluginEventType, listener: PluginEventListener): () => void {
    return this.eventEmitter.on(type, listener);
  }

  /**
   * Get load order (highest priority first)
   */
  getLoadOrder(): PluginId[] {
    return [...this.loadOrder];
  }

  // ----- Private Methods -----

  private validatePlugin(manifest: PluginManifest): { valid: boolean; error?: string } {
    if (!manifest.id) {
      return { valid: false, error: 'Plugin ID is required' };
    }

    if (!manifest.name) {
      return { valid: false, error: 'Plugin name is required' };
    }

    if (!manifest.version) {
      return { valid: false, error: 'Plugin version is required' };
    }

    // Validate ID format
    const idPattern = /^[a-z0-9-]+\/[a-z0-9-]+$/;
    if (!idPattern.test(manifest.id)) {
      return { valid: false, error: 'Plugin ID must be in format: vendor-name/plugin-name' };
    }

    return { valid: true };
  }

  private checkConflicts(manifest: PluginManifest): { valid: boolean; error?: string } {
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

    // Check if another plugin declares conflict with this one
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

  private checkDependencies(manifest: PluginManifest): { valid: boolean; error?: string } {
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

      // Version check (simplified - use semver library for production)
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
    // Simplified version comparison - use semver library for production
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
      if (plugin.dependencies?.some((dep) => dep.pluginId === pluginId)) {
        dependents.push(plugin.id);
      }
    }

    return dependents;
  }

  private updateLoadOrder(manifest: PluginManifest): void {
    // Insert based on priority
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

  private async loadPluginStates(): Promise<void> {
    try {
      const stored = localStorage.getItem('plugin_states');
      if (stored) {
        const states: PluginState[] = JSON.parse(stored);
        for (const state of states) {
          this.pluginStates.set(state.id, state);
        }
      }
    } catch (error) {
      console.error('Failed to load plugin states:', error);
    }
  }

  private savePluginStates(): void {
    try {
      const states = Array.from(this.pluginStates.values());
      localStorage.setItem('plugin_states', JSON.stringify(states));
    } catch (error) {
      console.error('Failed to save plugin states:', error);
    }
  }

  /**
   * Reset the registry (useful for testing)
   */
  reset(): void {
    this.plugins.clear();
    this.pluginStates.clear();
    this.loadOrder = [];
    this.eventEmitter.clear();
    this.initialized = false;
  }
}

// -----------------------------------------------------------------------------
// Singleton Instance
// -----------------------------------------------------------------------------

export const PluginRegistry = new PluginRegistryImpl();

// -----------------------------------------------------------------------------
// Convenience Hooks
// ----------------------------------------------------------------------------

import { useEffect, useState } from 'react';

/**
 * Hook to get all plugins
 */
export function usePlugins() {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);

  useEffect(() => {
    setPlugins(PluginRegistry.getAllPlugins());

    const unsubscribe = PluginRegistry.on('plugin.loaded' as PluginEventType, () => {
      setPlugins(PluginRegistry.getAllPlugins());
    });

    return unsubscribe;
  }, []);

  return plugins;
}

/**
 * Hook to get plugin states
 */
export function usePluginStates() {
  const [states, setStates] = useState<PluginState[]>([]);

  useEffect(() => {
    setStates(PluginRegistry.getAllPluginStates());

    const unsubscribe = PluginRegistry.on('plugin.settings_changed' as PluginEventType, () => {
      setStates(PluginRegistry.getAllPluginStates());
    });

    return unsubscribe;
  }, []);

  return states;
}

/**
 * Hook to get navigation items
 */
export function useNavigation(scope: 'main' | 'admin' | 'user') {
  const [items, setItems] = useState<PluginNavigationItem[]>([]);

  useEffect(() => {
    const updateItems = () => {
      setItems(PluginRegistry.getNavigationItems(scope));
    };

    updateItems();

    const unsubscribes = [
      PluginRegistry.on('plugin.enabled' as PluginEventType, updateItems),
      PluginRegistry.on('plugin.disabled' as PluginEventType, updateItems),
    ];

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [scope]);

  return items;
}
