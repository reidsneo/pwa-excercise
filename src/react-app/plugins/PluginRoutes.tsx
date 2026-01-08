// =============================================================================
// PLUGIN ROUTES - REACT ROUTER INTEGRATION
// =============================================================================
// Dynamically generates routes from enabled plugins
// =============================================================================

import { Suspense, useEffect, useState } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { ComponentType } from 'react';
import React from 'react';
import { NavLink } from 'react-router-dom';
import { PluginRegistry } from './PluginRegistry';
import type { PluginRoute, PluginNavigationItem, PluginComponent } from '@/shared/plugin';
import { PluginEventType } from '@/shared/plugin';

// -----------------------------------------------------------------------------
// Lazy Loading Wrapper for Plugin Routes
// -----------------------------------------------------------------------------

interface PluginRouteWrapperProps {
  pluginId: string;
  lazyImport: () => Promise<{ default: React.ComponentType }>;
  fallback?: React.ReactNode;
}

function PluginRouteWrapper({ pluginId, lazyImport, fallback }: PluginRouteWrapperProps) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lazyImport()
      .then((module) => {
        setComponent(() => module.default);
      })
      .catch((err) => {
        console.error(`Failed to load plugin route for ${pluginId}:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      });
  }, [pluginId, lazyImport]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <h3 className="text-red-800 font-semibold">Plugin Error</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!Component) {
    return fallback ? <>{fallback}</> : <div className="p-4">Loading...</div>;
  }

  return <Component />;
}

// -----------------------------------------------------------------------------
// Route Generator
// -----------------------------------------------------------------------------

/**
 * Convert plugin routes to React Router route objects
 */
function generateRouteObjects(pluginRoutes: PluginRoute[]): RouteObject[] {
  const routeObjects: RouteObject[] = [];

  for (const pluginRoute of pluginRoutes) {
    const routeObj: RouteObject = {
      path: pluginRoute.path,
    };

    // Handle lazy-loaded routes
    if (pluginRoute.lazy) {
      const lazyImport =
        typeof pluginRoute.component === 'function'
          ? (pluginRoute.component as () => Promise<{ default: ComponentType }>)
          : () => Promise.resolve({ default: pluginRoute.component as ComponentType });

      routeObj.element = (
        <Suspense fallback={<div className="p-4">Loading...</div>}>
          <PluginRouteWrapper
            pluginId={pluginRoute.path}
            lazyImport={lazyImport}
          />
        </Suspense>
      );
    } else {
      const Component = pluginRoute.component as ComponentType;
      routeObj.element = <Component />;
    }

    routeObjects.push(routeObj);
  }

  return routeObjects;
}

/**
 * Get all plugin routes as React Router route objects
 */
export function getPluginRouteObjects(): RouteObject[] {
  const pluginRoutes = PluginRegistry.getPluginRoutes();
  return generateRouteObjects(pluginRoutes);
}

/**
 * Hook to get plugin routes reactively
 */
export function usePluginRoutes(): RouteObject[] {
  const [routes, setRoutes] = useState<RouteObject[]>([]);

  useEffect(() => {
    const updateRoutes = () => {
      setRoutes(getPluginRouteObjects());
    };

    updateRoutes();

    const unsubscribes = [
      PluginRegistry.on(PluginEventType.ENABLED, updateRoutes),
      PluginRegistry.on(PluginEventType.DISABLED, updateRoutes),
      PluginRegistry.on(PluginEventType.LOADED, updateRoutes),
    ];

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, []);

  return routes;
}

// -----------------------------------------------------------------------------
// Navigation Components
// -----------------------------------------------------------------------------

interface PluginNavigationLinkProps {
  item: PluginNavigationItem;
}

// Helper component to render icon
function IconRenderer({ icon }: { icon: unknown }): React.ReactElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = icon as any;
  if (typeof icon === 'string') {
    return <span className="text-lg">{icon}</span> as React.ReactElement;
  }
  return <Icon /> as React.ReactElement;
}

export function PluginNavigationLink({ item }: PluginNavigationLinkProps) {
  return (
    <NavLink
      to={item.path || '#'}
      className={({ isActive }) => `
        flex items-center gap-2 px-3 py-2 rounded-md transition-colors
        ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}
      `}
    >
      {item.icon ? (
        <span className="flex-shrink-0">
          {/* Support both component and string icons */}
          <IconRenderer icon={item.icon} />
        </span>
      ) : null}
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="flex-shrink-0 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

interface PluginNavigationProps {
  scope: 'main' | 'admin' | 'user';
  className?: string;
}

export function PluginNavigation({ scope, className = '' }: PluginNavigationProps) {
  const [items, setItems] = useState<PluginNavigationItem[]>([]);

  useEffect(() => {
    const updateItems = () => {
      setItems(PluginRegistry.getNavigationItems(scope));
    };

    updateItems();

    const unsubscribes = [
      PluginRegistry.on(PluginEventType.ENABLED, updateItems),
      PluginRegistry.on(PluginEventType.DISABLED, updateItems),
    ];

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [scope]);

  if (items.length === 0) {
    return null;
  }

  return (
    <nav className={`space-y-1 ${className}`}>
      {items.map((item, index) => (
        <PluginNavigationLink key={`${item.path}-${index}`} item={item} />
      ))}
    </nav>
  );
}

// -----------------------------------------------------------------------------
// Component Slot System
// -----------------------------------------------------------------------------

interface PluginSlotProps {
  name: string;
  children?: React.ReactNode;
}

export function PluginSlot({ name, children }: PluginSlotProps) {
  const [components, setComponents] = useState<PluginComponent[]>([]);

  useEffect(() => {
    const updateComponents = () => {
      setComponents(PluginRegistry.getComponentsForSlot(name));
    };

    updateComponents();

    const unsubscribes = [
      PluginRegistry.on(PluginEventType.ENABLED, updateComponents),
      PluginRegistry.on(PluginEventType.DISABLED, updateComponents),
    ];

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [name]);

  return (
    <>
      {components.map((comp, index) => {
        const Component = comp.component as ComponentType;
        return <Component key={`${name}-${index}`} {...comp.props} />;
      })}
      {children}
    </>
  );
}
