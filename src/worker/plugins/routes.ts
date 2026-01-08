// =============================================================================
// PLUGIN MANAGEMENT API ROUTES
// =============================================================================
// REST API for managing plugins (install, enable, disable, etc.)
// =============================================================================

import { Hono } from 'hono';
import { BackendPluginRegistry } from './BackendPluginRegistry';
import type {
  PluginId,
  PluginPackage,
  MarketplaceResponse,
} from '../../shared/plugin/index.ts';

// -----------------------------------------------------------------------------
// Plugin API Routes
// -----------------------------------------------------------------------------

export const pluginRoutes = new Hono();

/**
 * GET /api/plugins
 * List all plugins with their states
 */
pluginRoutes.get('/', async (c) => {
  const plugins = BackendPluginRegistry.getAllPlugins();
  const states = BackendPluginRegistry.getAllPluginStates();

  // Combine manifests with states
  const result = states.map((state) => {
    const manifest = plugins.find((p) => p.id === state.id);
    return {
      ...state,
      manifest,
    };
  });

  return c.json({ plugins: result });
});

/**
 * GET /api/plugins/:pluginId
 * Get a specific plugin's details
 */
pluginRoutes.get('/:pluginId', async (c) => {
  const pluginId = c.req.param('pluginId') as PluginId;
  const plugin = BackendPluginRegistry.getPlugin(pluginId);
  const state = BackendPluginRegistry.getPluginState(pluginId);

  if (!plugin || !state) {
    return c.json({ error: 'Plugin not found' }, 404);
  }

  return c.json({
    manifest: plugin,
    state,
  });
});

/**
 * POST /api/plugins/:pluginId/enable
 * Enable a plugin
 */
pluginRoutes.post('/:pluginId/enable', async (c) => {
  const pluginId = c.req.param('pluginId') as PluginId;
  const result = await BackendPluginRegistry.enable(pluginId);

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ success: true, pluginId });
});

/**
 * POST /api/plugins/:pluginId/disable
 * Disable a plugin
 */
pluginRoutes.post('/:pluginId/disable', async (c) => {
  const pluginId = c.req.param('pluginId') as PluginId;
  const result = await BackendPluginRegistry.disable(pluginId);

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ success: true, pluginId });
});

/**
 * PUT /api/plugins/:pluginId/config
 * Update plugin configuration
 */
pluginRoutes.put('/:pluginId/config', async (c) => {
  const pluginId = c.req.param('pluginId') as PluginId;
  const config = await c.req.json();

  BackendPluginRegistry.updatePluginConfig(pluginId, config);

  return c.json({ success: true, pluginId });
});

/**
 * DELETE /api/plugins/:pluginId
 * Uninstall/remove a plugin
 */
pluginRoutes.delete('/:pluginId', async (c) => {
  const pluginId = c.req.param('pluginId') as PluginId;

  await BackendPluginRegistry.unregister(pluginId);

  return c.json({ success: true, pluginId });
});

// -----------------------------------------------------------------------------
// Plugin Marketplace Routes
// -----------------------------------------------------------------------------

/**
 * GET /api/plugins/marketplace
 * Browse available plugins in the marketplace
 */
pluginRoutes.get('/marketplace', async (c) => {
  const query = c.req.query();
  const page = parseInt(query.page || '1');
  const pageSize = parseInt(query.pageSize || '20');
  const search = query.search || '';
  const tag = query.tag || '';

  // TODO: Connect to actual marketplace API
  // For now, return mock data
  const mockPlugins: PluginPackage[] = [
    {
      manifest: {
        id: 'example/blog' as PluginId,
        name: 'Blog Plugin',
        description: 'A simple blog plugin with posts and comments',
        version: '1.0.0',
        author: 'Example Vendor',
        routes: [
          {
            path: '/blog',
            component: () => Promise.resolve({ default: () => null }),
          },
        ],
      },
      downloadUrl: 'https://example.com/plugins/blog.tar.gz',
      rating: 4.5,
      reviewCount: 42,
      downloadCount: 1250,
      tags: ['blog', 'content', 'cms'],
      featured: true,
    },
  ];

  const filtered = mockPlugins.filter((p) => {
    if (search && !p.manifest.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (tag && !p.tags?.includes(tag)) {
      return false;
    }
    return true;
  });

  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  const response: MarketplaceResponse = {
    plugins: paginated,
    total: filtered.length,
    page,
    pageSize,
    hasMore: start + pageSize < filtered.length,
  };

  return c.json(response);
});

/**
 * POST /api/plugins/marketplace/:pluginId/install
 * Install a plugin from the marketplace
 */
pluginRoutes.post('/marketplace/:pluginId/install', async (c) => {
  const pluginId = c.req.param('pluginId') as PluginId;

  // TODO: Implement actual installation
  // 1. Download plugin package
  // 2. Verify checksum
  // 3. Extract to plugins directory
  // 4. Load and register plugin
  // 5. Run migrations if any

  return c.json({
    success: true,
    message: `Plugin ${pluginId} installed successfully`,
  });
});

/**
 * GET /api/plugins/marketplace/tags
 * Get available tags/categories
 */
pluginRoutes.get('/marketplace/tags', async (c) => {
  // TODO: Get tags from marketplace
  const tags = [
    { id: 'blog', name: 'Blog', count: 15 },
    { id: 'ecommerce', name: 'E-Commerce', count: 23 },
    { id: 'analytics', name: 'Analytics', count: 8 },
    { id: 'social', name: 'Social', count: 12 },
    { id: 'content', name: 'Content', count: 19 },
  ];

  return c.json({ tags });
});

// -----------------------------------------------------------------------------
// Plugin Dependencies Routes
// -----------------------------------------------------------------------------

/**
 * GET /api/plugins/:pluginId/dependencies
 * Get plugin dependencies
 */
pluginRoutes.get('/:pluginId/dependencies', async (c) => {
  const pluginId = c.req.param('pluginId') as PluginId;
  const plugin = BackendPluginRegistry.getPlugin(pluginId);

  if (!plugin) {
    return c.json({ error: 'Plugin not found' }, 404);
  }

  return c.json({
    pluginId,
    dependencies: plugin.dependencies || [],
  });
});

/**
 * GET /api/plugins/:pluginId/dependents
 * Get plugins that depend on this plugin
 */
pluginRoutes.get('/:pluginId/dependents', async (c) => {
  const pluginId = c.req.param('pluginId') as PluginId;

  const dependents: PluginId[] = [];
  for (const plugin of BackendPluginRegistry.getAllPlugins()) {
    if (plugin.dependencies?.some((dep: { pluginId: PluginId }) => dep.pluginId === pluginId)) {
      dependents.push(plugin.id);
    }
  }

  return c.json({
    pluginId,
    dependents,
  });
});

// -----------------------------------------------------------------------------
// Plugin Permissions Routes
// -----------------------------------------------------------------------------

/**
 * GET /api/plugins/:pluginId/permissions
 * Get permissions defined by a plugin
 */
pluginRoutes.get('/:pluginId/permissions', async (c) => {
  const pluginId = c.req.param('pluginId') as PluginId;
  const plugin = BackendPluginRegistry.getPlugin(pluginId);

  if (!plugin) {
    return c.json({ error: 'Plugin not found' }, 404);
  }

  // Note: permissions are on the frontend manifest
  // For backend, we might want to mirror this
  return c.json({
    pluginId,
    permissions: [], // TODO: Get from plugin manifest
  });
});

// -----------------------------------------------------------------------------
// Export routes for mounting
// -----------------------------------------------------------------------------

export { pluginRoutes as default };
