// =============================================================================
// PLUGIN SYSTEM - FRONTEND EXPORTS
// =============================================================================

export { PluginRegistry, usePlugins, usePluginStates, useNavigation } from './PluginRegistry';
export { PluginLoader, usePluginLoader } from './PluginLoader';
export type {
  PluginManifest,
  PluginState,
  PluginRoute,
  PluginNavigationItem,
  PluginComponent,
  PluginSettingsPanel,
  PluginEvent,
  PluginEventType,
  PluginLoadResult,
  PluginDependency,
  PluginPermission,
  PluginId,
} from '@/shared/plugin';
