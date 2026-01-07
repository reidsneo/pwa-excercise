// =============================================================================
// PLUGIN SYSTEM - SHARED TYPES
// =============================================================================
// This file contains all shared plugin types used by both frontend and backend
// =============================================================================

// -----------------------------------------------------------------------------
// Plugin Metadata & Identity
// -----------------------------------------------------------------------------

/**
 * Unique plugin identifier (format: vendor-name/plugin-name)
 * @example "my-company/user-dashboard"
 */
export type PluginId = `${string}/${string}`;

/**
 * Semantic version string
 * @example "1.0.0", "2.1.3-beta"
 */
export type PluginVersion = string;

/**
 * Plugin lifecycle stages
 */
export enum PluginStatus {
  /** Plugin is installed but not active */
  INSTALLED = 'installed',
  /** Plugin is active and running */
  ENABLED = 'enabled',
  /** Plugin is disabled but still installed */
  DISABLED = 'disabled',
  /** Plugin has errors and cannot run */
  ERROR = 'error',
  /** Plugin is being installed */
  INSTALLING = 'installing',
  /** Plugin is being uninstalled */
  UNINSTALLING = 'uninstalling',
}

// -----------------------------------------------------------------------------
// Plugin Dependencies & Ordering
// -----------------------------------------------------------------------------

/**
 * Dependency declaration for plugins
 */
export interface PluginDependency {
  /** Plugin ID that is required */
  pluginId: PluginId;
  /** Minimum version required (semver) */
  minVersion?: PluginVersion;
  /** Maximum version allowed (semver) */
  maxVersion?: PluginVersion;
}

/**
 * Load order priority (higher loads first)
 */
export type PluginPriority = number;

// -----------------------------------------------------------------------------
// Plugin Permissions & RBAC
// -----------------------------------------------------------------------------

/**
 * Permission definition for a plugin
 */
export interface PluginPermission {
  /** Unique permission identifier (e.g., "plugin.blog:posts.create") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this permission allows */
  description?: string;
  /** Category/group for organizing permissions */
  category?: string;
}

/**
 * Permission scope definition
 */
export interface PluginPermissionScope {
  /** Resource identifier (e.g., "posts", "comments") */
  resource: string;
  /** Allowed actions (e.g., ["create", "read", "update", "delete"]) */
  actions: string[];
}

// -----------------------------------------------------------------------------
// Frontend Plugin Contract
// -----------------------------------------------------------------------------

/**
 * Route definition for plugin pages
 */
export interface PluginRoute {
  /** Path pattern (e.g., "/blog", "/blog/:id") */
  path: string;
  /** Component to render */
  component: unknown;
  /** Whether to lazy load this route */
  lazy?: boolean;
  /** Navigation item configuration */
  navItem?: PluginNavigationItem;
}

/**
 * Navigation item for plugin menus
 */
export interface PluginNavigationItem {
  /** Display label */
  label: string;
  /** Path for the navigation item */
  path?: string;
  /** Icon component or name */
  icon?: unknown;
  /** Order in navigation (lower = first) */
  order?: number;
  /** Parent navigation item ID (for nested menus) */
  parentId?: string;
  /** Required permission to view this item */
  permission?: string;
  /** Badge text or count */
  badge?: string | number;
}

/**
 * Settings panel component for plugin configuration
 */
export interface PluginSettingsPanel {
  /** Component for settings UI */
  component: unknown;
  /** Navigation label for settings */
  label: string;
  /** Order in settings menu */
  order?: number;
}

/**
 * Component that can be injected into app shells
 */
export interface PluginComponent {
  /** Unique identifier for injection point */
  slot: string;
  /** Component to render */
  component: unknown;
  /** Props to pass to component */
  props?: Record<string, unknown>;
}

/**
 * Hook provided by plugin
 */
export interface PluginHook {
  /** Hook name */
  name: string;
  /** Hook function */
  fn: (...args: unknown[]) => unknown;
}

/**
 * Frontend plugin manifest
 */
export interface PluginManifest {
  // ----- Identity -----
  /** Unique plugin identifier */
  id: PluginId;
  /** Human-readable name */
  name: string;
  /** Plugin description */
  description?: string;
  /** Plugin version */
  version: PluginVersion;
  /** Plugin author/organization */
  author?: string;
  /** Homepage URL */
  homepage?: string;
  /** Documentation URL */
  docs?: string;
  /** Repository URL */
  repository?: string;

  // ----- Lifecycle -----
  /** Load order priority (higher loads first) */
  priority?: PluginPriority;
  /** Required plugins/versions */
  dependencies?: PluginDependency[];
  /** Conflicting plugins */
  conflicts?: PluginId[];
  /** Required permissions */
  permissions?: PluginPermission[];

  // ----- Frontend Hooks -----
  /** Called when plugin is registered */
  onLoad?: () => void | Promise<void>;
  /** Called when plugin is enabled */
  onEnable?: () => void | Promise<void>;
  /** Called when plugin is disabled */
  onDisable?: () => void | Promise<void>;
  /** Called when plugin is uninstalled */
  onUninstall?: () => void | Promise<void>;

  // ----- Routing -----
  /** Routes provided by plugin */
  routes?: PluginRoute[];

  // ----- Navigation -----
  /** Main navigation items */
  navigation?: PluginNavigationItem[];
  /** Admin navigation items */
  adminNavigation?: PluginNavigationItem[];
  /** User navigation items */
  userNavigation?: PluginNavigationItem[];

  // ----- Settings -----
  /** Settings panel configuration */
  settings?: PluginSettingsPanel;

  // ----- Component Injection -----
  /** Components to inject into app */
  components?: PluginComponent[];

  // ----- Hooks -----
  /** Custom hooks provided by plugin */
  hooks?: PluginHook[];

  // ----- Assets -----
  /** Additional stylesheets to load */
  styles?: string[];
  /** Additional scripts to load */
  scripts?: string[];

  // ----- Extension Points -----
  /** Custom extension points for other plugins */
  extensionPoints?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Backend Plugin Contract (Hono)
// -----------------------------------------------------------------------------

/**
 * API endpoint configuration
 */
export interface PluginApiEndpoint {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Route path (will be prefixed with /api/plugins/:pluginId) */
  path: string;
  /** Required permission to access endpoint */
  permission?: string;
  /** Whether endpoint requires authentication */
  authRequired?: boolean;
}

/**
 * Backend database migration
 */
export interface PluginMigration {
  /** Migration version */
  version: string;
  /** Migration name/description */
  name: string;
  /** SQL migration script */
  up: string;
  /** Rollback script */
  down: string;
}

/**
 * Scheduled task configuration
 */
export interface PluginScheduledTask {
  /** Unique task identifier */
  id: string;
  /** Cron expression */
  schedule: string;
  /** Handler function */
  handler: () => void | Promise<void>;
  /** Human-readable description */
  description?: string;
}

/**
 * Webhook event configuration
 */
export interface PluginWebhook {
  /** Event name */
  event: string;
  /** Handler function */
  handler: (payload: unknown) => void | Promise<void>;
}

/**
 * Backend plugin manifest
 */
export interface BackendPluginManifest {
  // ----- Identity (same as frontend) -----
  id: PluginId;
  name: string;
  version: PluginVersion;

  // ----- Dependencies -----
  priority?: PluginPriority;
  dependencies?: PluginDependency[];
  conflicts?: PluginId[];

  // ----- Lifecycle -----
  onLoad?: () => void | Promise<void>;
  onEnable?: () => void | Promise<void>;
  onDisable?: () => void | Promise<void>;
  onUninstall?: () => void | Promise<void>;

  // ----- API Routes -----
  /** API endpoints provided by plugin */
  endpoints?: PluginApiEndpoint[];

  // ----- Database -----
  /** Database migrations */
  migrations?: PluginMigration[];

  // ----- Scheduled Tasks -----
  /** Scheduled/cron jobs */
  scheduledTasks?: PluginScheduledTask[];

  // ----- Webhooks -----
  /** Webhook event handlers */
  webhooks?: PluginWebhook[];

  // ----- Middleware -----
  /** Hono middleware to inject */
  middleware?: HonoMiddleware[];
}

/**
 * Hono middleware definition
 */
export interface HonoMiddleware {
  /** Middleware function */
  handler: () => unknown;
  /** Routes to apply middleware to (empty = all routes) */
  routes?: string[];
}

// -----------------------------------------------------------------------------
// Plugin Registry State
// -----------------------------------------------------------------------------

/**
 * Stored plugin state
 */
export interface PluginState {
  /** Plugin identifier */
  id: PluginId;
  /** Current status */
  status: PluginStatus;
  /** Installed version */
  version: PluginVersion;
  /** Installation timestamp */
  installedAt?: string;
  /** Last updated timestamp */
  updatedAt?: string;
  /** Plugin-specific configuration */
  config?: Record<string, unknown>;
  /** Error message if in ERROR state */
  error?: string;
}

/**
 * Plugin load result
 */
export interface PluginLoadResult {
  /** Plugin ID */
  id: PluginId;
  /** Whether loading was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Warnings during load */
  warnings?: string[];
}

// -----------------------------------------------------------------------------
// Plugin Marketplace
// -----------------------------------------------------------------------------

/**
 * Plugin package in marketplace
 */
export interface PluginPackage {
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Download URL (npm, git, etc.) */
  downloadUrl: string;
  /** Checksum for integrity verification */
  checksum?: string;
  /** File size in bytes */
  size?: number;
  /** Average rating (0-5) */
  rating?: number;
  /** Number of reviews */
  reviewCount?: number;
  /** Number of downloads */
  downloadCount?: number;
  /** Screenshots */
  screenshots?: string[];
  /** Tags/categories */
  tags?: string[];
  /** Featured flag */
  featured?: boolean;
  /** Last updated timestamp */
  lastUpdated?: string;
}

/**
 * Marketplace response
 */
export interface MarketplaceResponse {
  /** Available plugins */
  plugins: PluginPackage[];
  /** Total count */
  total: number;
  /** Page number */
  page: number;
  /** Page size */
  pageSize: number;
  /** Has more pages */
  hasMore: boolean;
}

// -----------------------------------------------------------------------------
// Plugin Events
// -----------------------------------------------------------------------------

/**
 * Plugin event types
 */
export enum PluginEventType {
  /** Plugin was loaded */
  LOADED = 'plugin.loaded',
  /** Plugin was enabled */
  ENABLED = 'plugin.enabled',
  /** Plugin was disabled */
  DISABLED = 'plugin.disabled',
  /** Plugin was uninstalled */
  UNINSTALLED = 'plugin.uninstalled',
  /** Plugin encountered an error */
  ERROR = 'plugin.error',
  /** Plugin settings changed */
  SETTINGS_CHANGED = 'plugin.settings_changed',
}

/**
 * Plugin event payload
 */
export interface PluginEvent {
  /** Event type */
  type: PluginEventType;
  /** Plugin ID */
  pluginId: PluginId;
  /** Event data */
  data?: unknown;
  /** Timestamp */
  timestamp: string;
}

// -----------------------------------------------------------------------------
// Plugin Configuration
// -----------------------------------------------------------------------------

/**
 * Plugin system configuration
 */
export interface PluginSystemConfig {
  /** Directory containing frontend plugins */
  pluginsDir: string;
  /** Directory containing backend plugins */
  backendPluginsDir: string;
  /** Whether to automatically load plugins on startup */
  autoLoad: boolean;
  /** Whether to enable lazy loading */
  lazyLoad: boolean;
  /** Marketplace URL */
  marketplaceUrl?: string;
  /** Maximum number of plugins */
  maxPlugins?: number;
}
