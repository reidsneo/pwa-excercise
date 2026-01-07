// =============================================================================
// ADMIN PLUGINS MANAGEMENT PAGE
// =============================================================================
// Full-featured plugin management interface for admin
// =============================================================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Switch,
} from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Puzzle,
  Download,
  Trash2,
  Settings,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { usePlugins, usePluginStates } from '@/plugins';
import type { PluginState, PluginManifest } from '@/shared/plugin';
import { PluginStatus } from '@/shared/plugin';

// -----------------------------------------------------------------------------
// Plugin Status Badge Component
// -----------------------------------------------------------------------------

function PluginStatusBadge({ status }: { status: PluginStatus }) {
  const variants: Record<string, { color: string; icon: React.ReactNode }> = {
    [PluginStatus.INSTALLED]: { color: 'bg-yellow-500/10 text-yellow-700', icon: <AlertCircle className="w-3 h-3" /> },
    [PluginStatus.ENABLED]: { color: 'bg-green-500/10 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
    [PluginStatus.DISABLED]: { color: 'bg-gray-500/10 text-gray-700', icon: <XCircle className="w-3 h-3" /> },
    [PluginStatus.ERROR]: { color: 'bg-red-500/10 text-red-700', icon: <AlertCircle className="w-3 h-3" /> },
    [PluginStatus.INSTALLING]: { color: 'bg-blue-500/10 text-blue-700', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    [PluginStatus.UNINSTALLING]: { color: 'bg-orange-500/10 text-orange-700', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  };

  const variant = variants[status] || variants[PluginStatus.INSTALLED];

  return (
    <Badge className={variant.color}>
      <span className="flex items-center gap-1">
        {variant.icon}
        {status}
      </span>
    </Badge>
  );
}

// -----------------------------------------------------------------------------
// Plugin Card Component
// -----------------------------------------------------------------------------

interface PluginCardProps {
  manifest: PluginManifest;
  state: PluginState;
  onEnable: (id: string) => Promise<void>;
  onDisable: (id: string) => Promise<void>;
  onUninstall: (id: string) => Promise<void>;
  onConfigure: (id: string) => void;
  loading: boolean;
}

function PluginCard({ manifest, state, onEnable, onDisable, onUninstall, onConfigure, loading }: PluginCardProps) {

  const handleToggle = async () => {
    if (state.status === PluginStatus.ENABLED) {
      await onDisable(manifest.id);
    } else {
      await onEnable(manifest.id);
    }
  };

  const handleUninstall = async () => {
    if (confirm(`Are you sure you want to uninstall "${manifest.name}"?`)) {
      await onUninstall(manifest.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>{manifest.name}</CardTitle>
              <PluginStatusBadge status={state.status} />
            </div>
            <CardDescription className="mt-1">
              {manifest.description || 'No description'}
            </CardDescription>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>ID: {manifest.id}</span>
              <span>v{manifest.version}</span>
              {manifest.author && <span>by {manifest.author}</span>}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Switch
            checked={state.status === PluginStatus.ENABLED}
            onCheckedChange={handleToggle}
            disabled={loading || state.status === PluginStatus.ERROR}
          />
          <span className="text-sm text-muted-foreground">
            {state.status === PluginStatus.ENABLED ? 'Enabled' : 'Disabled'}
          </span>
          <div className="flex-1" />
          {manifest.settings && state.status === PluginStatus.ENABLED && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onConfigure(manifest.id)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUninstall}
            disabled={loading}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        {state.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-700">{state.error}</p>
          </div>
        )}
        {manifest.permissions && manifest.permissions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Permissions:</p>
            <div className="flex flex-wrap gap-2">
              {manifest.permissions.map((perm) => (
                <Badge key={perm.id} variant="outline" className="text-xs">
                  {perm.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Installed Plugins Tab
// -----------------------------------------------------------------------------

interface InstalledPluginsProps {
  manifests: PluginManifest[];
  states: PluginState[];
  onEnable: (id: string) => Promise<void>;
  onDisable: (id: string) => Promise<void>;
  onUninstall: (id: string) => Promise<void>;
  onConfigure: (id: string) => void;
  loadingPluginId: string | null;
}

function InstalledPlugins({ manifests, states, onEnable, onDisable, onUninstall, onConfigure, loadingPluginId }: InstalledPluginsProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredStates = states.filter((state) => {
    const manifest = manifests.find((m) => m.id === state.id);
    const matchesSearch =
      !search ||
      manifest?.name.toLowerCase().includes(search.toLowerCase()) ||
      manifest?.id.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || state.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
          <option value="error">Error</option>
        </select>
        <Button variant="outline" size="icon">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredStates.map((state) => {
          const manifest = manifests.find((m) => m.id === state.id);
          if (!manifest) return null;
          return (
            <PluginCard
              key={state.id}
              manifest={manifest}
              state={state}
              onEnable={onEnable}
              onDisable={onDisable}
              onUninstall={onUninstall}
              onConfigure={onConfigure}
              loading={loadingPluginId === manifest.id}
            />
          );
        })}
      </div>

      {filteredStates.length === 0 && (
        <div className="text-center py-12">
          <Puzzle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No plugins found</p>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Marketplace Tab (Placeholder)
// -----------------------------------------------------------------------------

interface MarketplaceProps {
  installedIds: string[];
  onInstall: (id: string) => Promise<void>;
  loadingPluginId: string | null;
}

function Marketplace({ installedIds, onInstall, loadingPluginId }: MarketplaceProps) {
  // Get available plugins from BackendPluginRegistry
  // For now, hardcode available plugins that can be installed
  const availablePlugins = [
    {
      id: 'blog/blog',
      name: 'Blog Plugin',
      description: 'Full-featured blog with posts, categories, and tags',
      version: '1.0.0',
      author: 'System',
    },
  ];

  const pluginsToShow = availablePlugins.filter((p) => !installedIds.includes(p.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Plugin Marketplace</h3>
          <p className="text-muted-foreground">
            Browse and install plugins from the marketplace
          </p>
        </div>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Upload Plugin
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {pluginsToShow.map((plugin) => (
          <Card key={plugin.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle>{plugin.name}</CardTitle>
                  <CardDescription className="mt-1">{plugin.description}</CardDescription>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>ID: {plugin.id}</span>
                    <span>v{plugin.version}</span>
                    <span>by {plugin.author}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => onInstall(plugin.id)}
                disabled={loadingPluginId === plugin.id}
              >
                {loadingPluginId === plugin.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Install Plugin
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {pluginsToShow.length === 0 && (
        <div className="text-center py-12">
          <Download className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No plugins available in the marketplace</p>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Dependencies Tab
// -----------------------------------------------------------------------------

function Dependencies({ manifests, states }: { manifests: PluginManifest[]; states: PluginState[] }) {
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plugin</TableHead>
            <TableHead>Dependencies</TableHead>
            <TableHead>Dependents</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {states.map((state) => {
            const manifest = manifests.find((m) => m.id === state.id);
            if (!manifest) return null;

            const dependencies = manifest.dependencies || [];
            const dependents = manifests.filter((m) =>
              m.dependencies?.some((d) => d.pluginId === manifest.id)
            );

            return (
              <TableRow key={state.id}>
                <TableCell className="font-medium">{manifest.name}</TableCell>
                <TableCell>
                  {dependencies.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {dependencies.map((dep) => (
                        <Badge key={dep.pluginId} variant="outline" className="text-xs">
                          {dep.pluginId}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {dependents.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {dependents.map((d) => (
                        <Badge key={d.id} variant="outline" className="text-xs">
                          {d.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Admin Plugins Page
// -----------------------------------------------------------------------------

export function AdminPlugins() {
  const manifests = usePlugins();
  const states = usePluginStates();
  const [configurePluginId, setConfigurePluginId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleEnable = async (id: string) => {
    setLoading(id);
    try {
      const response = await fetch(`/api/plugins/${id}/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Refresh the page to show updated state
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to enable plugin');
      }
    } catch (error) {
      console.error('Failed to enable plugin:', error);
      alert('Failed to enable plugin');
    } finally {
      setLoading(null);
    }
  };

  const handleDisable = async (id: string) => {
    setLoading(id);
    try {
      const response = await fetch(`/api/plugins/${id}/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to disable plugin');
      }
    } catch (error) {
      console.error('Failed to disable plugin:', error);
      alert('Failed to disable plugin');
    } finally {
      setLoading(null);
    }
  };

  const handleUninstall = async (id: string) => {
    if (!confirm(`Are you sure you want to uninstall "${id}"? This will remove all plugin data from the database.`)) {
      return;
    }

    setLoading(id);
    try {
      const response = await fetch(`/api/plugins/${id}/uninstall`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to uninstall plugin');
      }
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      alert('Failed to uninstall plugin');
    } finally {
      setLoading(null);
    }
  };

  const handleInstall = async (id: string) => {
    setLoading(id);
    try {
      // First register the plugin in the backend registry
      const response = await fetch(`/api/plugins/${id}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Then enable it (which runs migrations)
        await handleEnable(id);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to install plugin');
        setLoading(null);
      }
    } catch (error) {
      console.error('Failed to install plugin:', error);
      alert('Failed to install plugin');
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Plugins</h2>
          <p className="text-muted-foreground">
            {manifests.length} plugin{manifests.length !== 1 ? 's' : ''} installed
          </p>
        </div>
      </div>

      <Tabs defaultValue="installed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="installed">
            Installed ({states.length})
          </TabsTrigger>
          <TabsTrigger value="marketplace">
            Marketplace
          </TabsTrigger>
          <TabsTrigger value="dependencies">
            Dependencies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed">
          <InstalledPlugins
            manifests={manifests}
            states={states}
            onEnable={handleEnable}
            onDisable={handleDisable}
            onUninstall={handleUninstall}
            onConfigure={setConfigurePluginId}
            loadingPluginId={loading}
          />
        </TabsContent>

        <TabsContent value="marketplace">
          <Marketplace
            installedIds={manifests.map((m) => m.id)}
            onInstall={handleInstall}
            loadingPluginId={loading}
          />
        </TabsContent>

        <TabsContent value="dependencies">
          <Dependencies manifests={manifests} states={states} />
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={configurePluginId !== null} onOpenChange={() => setConfigurePluginId(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Configure Plugin</DialogTitle>
            <DialogDescription>
              Configure settings for {configurePluginId}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">Plugin configuration form will be displayed here.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigurePluginId(null)}>
              Cancel
            </Button>
            <Button>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
