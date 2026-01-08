# Plugin System Documentation

A comprehensive, WordPress-style plugin system for the PWA application. Plugins can be developed independently, dropped into a specific folder, and automatically discovered and loaded.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Creating a Plugin](#creating-a-plugin)
4. [Plugin Manifest](#plugin-manifest)
5. [Plugin Lifecycle](#plugin-lifecycle)
6. [Dependencies & Ordering](#dependencies--ordering)
7. [Permissions & RBAC](#permissions--rbac)
8. [Versioning](#versioning)
9. [Marketplace Pattern](#marketplace-pattern)
10. [Backend Plugins](#backend-plugins)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  Plugin Loader   │───▶│ Plugin Registry  │                   │
│  └──────────────────┘    └──────────────────┘                   │
│         │                         │                               │
│         │                         │                               │
│         ▼                         ▼                               │
│  ┌──────────────────────────────────────────────┐               │
│  │           Plugin Directory                    │               │
│  │  ┌─────────────┐  ┌─────────────┐           │               │
│  │  │   Plugin A  │  │   Plugin B  │  ...       │               │
│  │  └─────────────┘  └─────────────┘           │               │
│  └──────────────────────────────────────────────┘               │
│         │                         │                               │
│         ▼                         ▼                               │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  Dynamic Routes  │    │     Navigation   │                   │
│  └──────────────────┘    └──────────────────┘                   │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                      Backend (Hono)                              │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ Backend Plugin   │    │   API Routes     │                   │
│  │    Registry      │    │   /api/plugins   │                   │
│  └──────────────────┘    └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
/src
├── shared/
│   └── plugin/
│       ├── types.ts          # Shared types (frontend + backend)
│       └── index.ts
│
├── react-app/
│   ├── plugins/
│   │   ├── index.ts          # Plugin exports
│   │   ├── PluginLoader.ts   # Auto-discovery & loading
│   │   ├── PluginRegistry.ts # Core registry
│   │   ├── PluginRoutes.tsx  # React Router integration
│   │   │
│   │   └── [plugin-id]/      # Plugin folders
│   │       ├── manifest.ts   # Plugin manifest
│   │       ├── components/   # Plugin components
│   │       ├── hooks/        # Custom hooks
│   │       └── api.ts        # API clients
│   │
│   └── AppRouter.tsx         # App with plugin routes
│
└── worker/
    └── plugins/
        ├── index.ts
        ├── BackendPluginRegistry.ts
        └── routes.ts          # API routes
```

---

## Creating a Plugin

### Step 1: Create Plugin Directory

Create a new folder in `/src/react-app/plugins/`:

```bash
mkdir -p src/react-app/plugins/my-vendor/my-plugin
```

### Step 2: Create Manifest

Create `manifest.ts`:

```typescript
import type { PluginManifest } from '@/shared/plugin';

export const manifest: PluginManifest = {
  id: 'my-vendor/my-plugin',
  name: 'My Plugin',
  description: 'Does something cool',
  version: '1.0.0',

  // Routes
  routes: [
    {
      path: '/my-plugin',
      component: () => import('./components/HomePage').then(m => ({ default: m.HomePage })),
      lazy: true,
    },
  ],

  // Lifecycle hooks
  onEnable() {
    console.log('Plugin enabled!');
  },
};

export default manifest;
```

### Step 3: Create Components

```typescript
// src/react-app/plugins/my-vendor/my-plugin/components/HomePage.tsx
export function HomePage() {
  return (
    <div>
      <h1>My Plugin Home</h1>
    </div>
  );
}
```

### Step 4: Plugin is Auto-Discovered

The plugin will be automatically discovered and loaded on app startup!

---

## Plugin Manifest

The manifest is the core of a plugin. Here's a complete reference:

```typescript
interface PluginManifest {
  // ===== Identity =====
  id: PluginId;                    // Format: "vendor-name/plugin-name"
  name: string;                    // Human-readable name
  description?: string;            // Short description
  version: string;                 // Semver version
  author?: string;                 // Author/organization
  homepage?: string;               // Plugin homepage
  docs?: string;                   // Documentation URL
  repository?: string;             // Git repository URL

  // ===== Lifecycle =====
  priority?: number;               // Load order (higher = first)
  dependencies?: PluginDependency[];
  conflicts?: PluginId[];

  // Lifecycle hooks
  onLoad?: () => void | Promise<void>;
  onEnable?: () => void | Promise<void>;
  onDisable?: () => void | Promise<void>;
  onUninstall?: () => void | Promise<void>;

  // ===== Routing =====
  routes?: PluginRoute[];

  // ===== Navigation =====
  navigation?: PluginNavigationItem[];
  adminNavigation?: PluginNavigationItem[];
  userNavigation?: PluginNavigationItem[];

  // ===== Settings =====
  settings?: PluginSettingsPanel;

  // ===== Component Injection =====
  components?: PluginComponent[];

  // ===== Hooks =====
  hooks?: PluginHook[];

  // ===== Permissions =====
  permissions?: PluginPermission[];

  // ===== Assets =====
  styles?: string[];
  scripts?: string[];

  // ===== Extension Points =====
  extensionPoints?: Record<string, unknown>;
}
```

---

## Plugin Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Loaded   │───▶│ Enabled  │───▶│ Disabled │───▶│Removed   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
    │               │               │               │
    ▼               ▼               ▼               ▼
  onLoad         onEnable        onDisable      onUninstall
```

### onLoad

Called when plugin is first registered. Use for:
- Initial setup
- Registering event listeners
- Setting up internal state

```typescript
onLoad() {
  console.log('Plugin loaded');
}
```

### onEnable

Called when plugin is activated. Use for:
- Starting background tasks
- Connecting to external services
- Applying transformations

```typescript
onEnable() {
  // Start background sync
  startSync();
}
```

### onDisable

Called when plugin is deactivated. Use for:
- Stopping background tasks
- Cleaning up resources
- Saving state

```typescript
onDisable() {
  // Stop background sync
  stopSync();
}
```

### onUninstall

Called when plugin is removed. Use for:
- Cleaning up data
- Removing database tables
- Final cleanup

```typescript
onUninstall() {
  // Drop database tables
  await dropTables();
}
```

---

## Dependencies & Ordering

### Declaring Dependencies

```typescript
{
  dependencies: [
    {
      pluginId: 'example/blog',
      minVersion: '1.0.0',
      maxVersion: '2.0.0',
    }
  ]
}
```

### Priority-Based Loading

```typescript
{
  priority: 100,  // Higher loads first
}
```

Load order examples:
- Core plugins: `priority: 1000`
- Feature plugins: `priority: 100`
- UI plugins: `priority: 10`

### Checking Dependents

Before disabling a plugin, the system checks if other plugins depend on it:

```typescript
// Cannot disable if dependents exist
const dependents = await PluginRegistry.getDependents('example/blog');
```

---

## Permissions & RBAC

### Defining Permissions

```typescript
{
  permissions: [
    {
      id: 'plugin.blog:posts.create',
      name: 'Create Posts',
      description: 'Allow creating blog posts',
      category: 'Blog',
    }
  ]
}
```

### Checking Permissions

```typescript
import { useAuth } from '@/contexts/AuthContext';

function CreatePostButton() {
  const { hasPermission } = useAuth();

  if (!hasPermission('blog.posts.create')) {
    return null;
  }

  return <button>Create Post</button>;
}
```

### Permission Format

Follow the convention: `plugin.{plugin-id}:{resource}.{action}`

Examples:
- `plugin.blog:posts.create`
- `plugin.blog:posts.edit`
- `plugin.blog:comments.moderate`

---

## Versioning

### Semantic Versioning

Use semver for plugin versions:

```
MAJOR.MINOR.PATCH

1.0.0  → Initial release
1.1.0  → New feature (backward compatible)
1.1.1  → Bug fix
2.0.0  → Breaking changes
```

### Version Constraints

```typescript
{
  dependencies: [
    {
      pluginId: 'example/blog',
      minVersion: '1.0.0',  // >= 1.0.0
      maxVersion: '2.0.0',  // < 2.0.0
    }
  ]
}
```

---

## Marketplace Pattern

### Plugin Package

```typescript
interface PluginPackage {
  manifest: PluginManifest;
  downloadUrl: string;
  checksum?: string;
  size?: number;
  rating?: number;
  reviewCount?: number;
  downloadCount?: number;
  screenshots?: string[];
  tags?: string[];
  featured?: boolean;
  lastUpdated?: string;
}
```

### Installing from Marketplace

```typescript
// Frontend
const response = await fetch(`/api/plugins/marketplace/${pluginId}/install`, {
  method: 'POST',
});

// Backend handles:
// 1. Download package
// 2. Verify checksum
// 3. Extract to plugins directory
// 4. Load and register
// 5. Run migrations
```

---

## Backend Plugins

### Backend Manifest

```typescript
interface BackendPluginManifest {
  // Same identity as frontend
  id: PluginId;
  name: string;
  version: string;

  // API Endpoints
  endpoints?: PluginApiEndpoint[];

  // Database Migrations
  migrations?: PluginMigration[];

  // Scheduled Tasks
  scheduledTasks?: PluginScheduledTask[];

  // Webhooks
  webhooks?: PluginWebhook[];

  // Hono Middleware
  middleware?: HonoMiddleware[];
}
```

### Example Backend Plugin

```typescript
export const backendManifest: BackendPluginManifest = {
  id: 'example/blog',
  name: 'Blog Plugin',
  version: '1.0.0',

  // API Endpoints
  endpoints: [
    {
      method: 'GET',
      path: '/posts',
      authRequired: true,
    },
    {
      method: 'POST',
      path: '/posts',
      authRequired: true,
      permission: 'blog.posts.create',
    },
  ],

  // Migrations
  migrations: [
    {
      version: '1.0.0',
      name: 'Create posts table',
      up: `
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      down: 'DROP TABLE posts;',
    },
  ],

  // Scheduled Tasks
  scheduledTasks: [
    {
      id: 'cleanup',
      schedule: '0 0 * * *',  // Daily at midnight
      description: 'Cleanup old posts',
      handler: async () => {
        // Cleanup logic
      },
    },
  ],
};
```

---

## Advanced Features

### Component Injection

Inject components into specific slots:

```typescript
{
  components: [
    {
      slot: 'dashboard.widgets',
      component: StatsWidget,
      props: { showViews: true },
    }
  ]
}
```

### Custom Hooks

Provide hooks for other plugins:

```typescript
{
  hooks: [
    {
      name: 'useBlogPosts',
      fn: () => {
        // Hook implementation
      },
    }
  ]
}
```

### Extension Points

Define custom extension points:

```typescript
{
  extensionPoints: {
    'blog.post.render': (post) => {
      // Allow other plugins to modify post rendering
    },
  }
}
```

---

## API Reference

### PluginRegistry

```typescript
// Register a plugin
await PluginRegistry.register(manifest);

// Enable/Disable
await PluginRegistry.enable(pluginId);
await PluginRegistry.disable(pluginId);

// Get plugins
const plugins = PluginRegistry.getAllPlugins();
const enabled = PluginRegistry.getEnabledPlugins();

// Get routes/navigation
const routes = PluginRegistry.getPluginRoutes();
const nav = PluginRegistry.getNavigationItems('admin');

// Events
PluginRegistry.on('plugin.enabled', (event) => {
  console.log('Plugin enabled:', event.pluginId);
});
```

### PluginLoader

```typescript
// Load all plugins
await PluginLoader.load({
  pluginsDir: '/src/plugins',
  lazyLoad: true,
  onProgress: (loaded, total, current) => {
    console.log(`Loading ${current}: ${loaded}/${total}`);
  },
});

// Load single plugin
await PluginLoader.loadPlugin('example/blog');

// Discover available plugins
const pluginIds = await PluginLoader.discoverPlugins(config);
```

---

## Best Practices

1. **Plugin ID Format**: Always use `vendor-name/plugin-name`
2. **Versioning**: Follow semantic versioning
3. **Dependencies**: Declare all dependencies explicitly
4. **Permissions**: Define granular permissions
5. **Error Handling**: Always handle errors in lifecycle hooks
6. **Lazy Loading**: Use lazy loading for routes when possible
7. **Cleanup**: Properly clean up in onDisable/onUninstall
8. **Documentation**: Document your plugin's API and hooks
9. **Testing**: Test your plugin independently
10. **Security**: Validate all inputs and check permissions

---

## Example Plugin

See `/src/react-app/plugins/example-blog/manifest.ts` for a complete example.

---

## Troubleshooting

### Plugin Not Loading

1. Check manifest has required fields (id, name, version)
2. Verify plugin ID format: `vendor-name/plugin-name`
3. Check browser console for errors
4. Ensure dependencies are installed

### Dependencies Issues

1. Verify dependency plugin IDs are correct
2. Check version constraints are valid
3. Ensure dependency plugins are installed

### Permission Errors

1. Check user has required permissions
2. Verify permission IDs match manifest
3. Check RBAC configuration

---

## Future Enhancements

- [ ] Hot Module Replacement for plugin development
- [ ] Plugin sandboxing/isolation
- [ ] Distributed marketplace
- [ ] Plugin monetization
- [ ] Plugin analytics
- [ ] A/B testing framework
- [ ] Plugin templates/scaffolding tool






Draft 
Files Created
Core Plugin System
File	Description
src/shared/plugin/types.ts	Shared types used by both frontend and backend
src/react-app/plugins/PluginRegistry.ts	Frontend plugin registry with lifecycle management
src/react-app/plugins/PluginLoader.ts	Auto-discovery and loading system
src/react-app/plugins/PluginRoutes.tsx	React Router integration
src/worker/plugins/BackendPluginRegistry.ts	Backend plugin registry for Hono
src/worker/plugins/routes.ts	API routes for plugin management
Admin UI
File	Description
src/react-app/pages/admin/AdminPluginsPage.tsx	Full admin plugin management interface
UI Components
File	Description
src/react-app/components/ui/badge.tsx	Badge component
src/react-app/components/ui/table.tsx	Table component
src/react-app/components/ui/switch.tsx	Switch component
src/react-app/components/ui/dialog.tsx	Dialog component
src/react-app/components/ui/tabs.tsx	Tabs component
Example & Documentation
File	Description
src/react-app/plugins/example-blog/manifest.ts	Example blog plugin
PLUGIN_SYSTEM.md	Complete documentation
Features Implemented
Plugin Contract - Shared types for frontend/backend
Plugin Registry - Central management with lifecycle hooks
Auto-Discovery - Plugins in /src/plugins/*/manifest.ts auto-loaded
Dynamic Routes - React Router integration
Navigation System - Plugin-based navigation injection
Backend Plugin System - Hono integration with API routes
Admin UI - List, enable/disable, install/remove plugins
Dependencies & Ordering - Priority-based loading with dependency resolution
Permissions & RBAC - Granular permission system
Versioning - Semver support with version constraints
Marketplace Pattern - Plugin package structure for distribution
Required Dependencies
You'll need to install these additional packages:

npm install @radix-ui/react-switch @radix-ui/react-dialog @radix-ui/react-tabs class-variance-authority
How to Create a Plugin
Create folder: src/react-app/plugins/my-vendor/my-plugin/
Create manifest.ts with plugin configuration
Components are auto-discovered and loaded
Access plugin at /admin/plugins to manage