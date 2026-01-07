// =============================================================================
// PLUGIN LOADER - FRONTEND
// =============================================================================
// Dynamically discovers and loads plugins from the plugins directory
// =============================================================================

import type { PluginManifest, PluginLoadResult, PluginId } from '@/shared/plugin';
import { PluginRegistry } from './PluginRegistry';

// -----------------------------------------------------------------------------
// Plugin Loader Configuration
// -----------------------------------------------------------------------------

export interface PluginLoaderConfig {
  /** Base directory for plugins */
  pluginsDir: string;
  /** Pattern to match plugin files */
  pattern?: string;
  /** Whether to lazy load plugins */
  lazyLoad?: boolean;
  /** Callback during load progress */
  onProgress?: (loaded: number, total: number, current: string) => void;
}

// -----------------------------------------------------------------------------
// Plugin Loader Class
// -----------------------------------------------------------------------------

class PluginLoaderImpl {
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  /**
   * Load all plugins from the specified directory
   */
  async load(config: PluginLoaderConfig): Promise<PluginLoadResult[]> {
    // Prevent duplicate loading
    if (this.loadingPromise) {
      return this.loadingPromise.then(() => []);
    }

    this.loadingPromise = this.performLoad(config);
    await this.loadingPromise;
    this.loadingPromise = null;

    return this.getLoadResults();
  }

  /**
   * Load a single plugin by ID
   */
  async loadPlugin(pluginId: string): Promise<PluginLoadResult> {
    try {
      // Import the plugin module
      const pluginModule = await import(`@/plugins/${pluginId}/index.tsx`);

      // Get the manifest
      const manifest: PluginManifest = pluginModule.manifest || pluginModule.default;

      if (!manifest) {
        return {
          id: pluginId as PluginId,
          success: false,
          error: 'Plugin does not export a manifest',
        };
      }

      // Register the plugin
      return await PluginRegistry.register(manifest);
    } catch (error) {
      return {
        id: pluginId as PluginId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get list of available plugin IDs
   */
  async discoverPlugins(_config: PluginLoaderConfig): Promise<string[]> {
    // Try to import a plugin manifest file
    // This requires Vite to be configured with proper aliases
    const pluginIds: string[] = ['blog'];

    try {
      // Use Vite's import.meta.glob to discover plugins
      const pluginModules = import.meta.glob('/src/react-app/plugins/*/index.tsx', {
        eager: false,
        import: 'default',
      });

      for (const path in pluginModules) {
        const pluginId = path.match(/\/src\/react-app\/plugins\/([^/]+)\//)?.[1];
        if (pluginId) {
          pluginIds.push(pluginId);
        }
      }
    } catch (error) {
      console.warn('Could not auto-discover plugins:', error);
    }

    return pluginIds;
  }

  /**
   * Check if plugins have been loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  // ----- Private Methods -----

  private async performLoad(config: PluginLoaderConfig): Promise<void> {
    // Discover available plugins
    const pluginIds = await this.discoverPlugins(config);

    const results: PluginLoadResult[] = [];
    let loaded = 0;

    // Load each plugin
    for (const pluginId of pluginIds) {
      // Notify progress
      config.onProgress?.(loaded, pluginIds.length, pluginId);

      const result = await this.loadPlugin(pluginId);
      results.push(result);

      if (result.success) {
        loaded++;
      } else {
        console.warn(`Failed to load plugin ${pluginId}:`, result.error);
      }
    }

    this.loaded = true;
  }

  private getLoadResults(): PluginLoadResult[] {
    const plugins = PluginRegistry.getAllPlugins();
    return plugins.map((plugin) => ({
      id: plugin.id,
      success: true,
    }));
  }

  /**
   * Reset the loader (useful for testing)
   */
  reset(): void {
    this.loaded = false;
    this.loadingPromise = null;
  }
}

// -----------------------------------------------------------------------------
// Singleton Instance
// -----------------------------------------------------------------------------

export const PluginLoader = new PluginLoaderImpl();

// -----------------------------------------------------------------------------
// React Integration
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';

export interface UsePluginLoaderResult {
  /** Whether plugins are currently loading */
  loading: boolean;
  /** Whether all plugins have been loaded */
  loaded: boolean;
  /** Number of plugins loaded */
  count: number;
  /** Any errors that occurred */
  errors: Array<{ pluginId: string; error: string }>;
  /** Reload all plugins */
  reload: () => Promise<void>;
}

/**
 * React hook to load plugins
 */
export function usePluginLoader(config: PluginLoaderConfig): UsePluginLoaderResult {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [count, setCount] = useState(0);
  const [errors, setErrors] = useState<Array<{ pluginId: string; error: string }>>([]);

  const loadPlugins = async () => {
    if (PluginLoader.isLoaded()) {
      setLoaded(true);
      setCount(PluginRegistry.getAllPlugins().length);
      return;
    }

    setLoading(true);
    setErrors([]);

    const results = await PluginLoader.load(config);

    const errorResults = results.filter((r) => !r.success);
    setErrors(
      errorResults.map((r) => ({
        pluginId: r.id,
        error: r.error ?? 'Unknown error',
      }))
    );

    setCount(results.filter((r) => r.success).length);
    setLoaded(true);
    setLoading(false);
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  return {
    loading,
    loaded,
    count,
    errors,
    reload: loadPlugins,
  };
}
