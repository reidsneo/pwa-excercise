// =============================================================================
// ADMIN PLUGINS MANAGEMENT PAGE
// =============================================================================
// Full-featured plugin management interface for admin
// =============================================================================

import { useState, useEffect } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import type { PluginState, PluginManifest } from '@/shared/plugin';
import { PluginStatus } from '@/shared/plugin';
import { useAuth } from '@/contexts/AuthContext';

// -----------------------------------------------------------------------------
// Auth Helper
// -----------------------------------------------------------------------------

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

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
  manifest: BackendPlugin | PluginManifest;
  state: PluginState;
  onEnable: (id: string) => Promise<void>;
  onDisable: (id: string) => Promise<void>;
  onUninstall: (id: string) => Promise<void>;
  onConfigure: (id: string) => void;
  loading: boolean;
}

function PluginCard({ manifest, state, onEnable, onDisable, onUninstall, onConfigure, loading }: PluginCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Type guard to check if manifest is a PluginManifest
  const isPluginManifest = (m: BackendPlugin | PluginManifest): m is PluginManifest => {
    return 'permissions' in m || 'settings' in m || 'routes' in m;
  };

  const hasSettings = isPluginManifest(manifest) && manifest.settings;
  const hasPermissions = isPluginManifest(manifest) && manifest.permissions && manifest.permissions.length > 0;

  const handleToggle = async () => {
    if (state.status === PluginStatus.ENABLED) {
      await onDisable(manifest.id);
    } else {
      await onEnable(manifest.id);
    }
  };

  const handleUninstall = async () => {
    setShowDeleteDialog(true);
  };

  const confirmUninstall = async () => {
    setShowDeleteDialog(false);
    await onUninstall(manifest.id);
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
          {hasSettings && state.status === PluginStatus.ENABLED && (
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
        {hasPermissions && isPluginManifest(manifest) && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Permissions:</p>
            <div className="flex flex-wrap gap-2">
              {manifest.permissions?.map((perm) => (
                <Badge key={perm.id} variant="outline" className="text-xs">
                  {perm.name}
                </Badge>
              )) || []}
            </div>
          </div>
        )}
      </CardContent>

      {/* Uninstall Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uninstall Plugin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to uninstall <strong>"{manifest.name}"</strong>? This will remove all plugin data from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUninstall} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Uninstall
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Installed Plugins Tab
// -----------------------------------------------------------------------------

interface InstalledPluginsProps {
  manifests: (BackendPlugin | PluginManifest)[];
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
// Marketplace Tab
// -----------------------------------------------------------------------------

interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category?: string;
  icon?: string;
  featured?: number;
  downloads?: number;
  rating?: number;
  tiers: PricingTier[];
}

interface PricingTier {
  tier_id: string;
  name: string;
  features: string[];
  price_monthly: number | null;
  price_yearly: number | null;
  price_lifetime: number | null;
  trial_days: number;
}

interface MarketplaceProps {
  installedIds: string[];
  onInstall: (id: string) => Promise<void>;
  loadingPluginId: string | null;
}

function Marketplace({ installedIds, onInstall, loadingPluginId }: MarketplaceProps) {
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState<MarketplacePlugin | null>(null);

  // Fetch marketplace plugins
  useEffect(() => {
    const fetchMarketplace = async () => {
      try {
        const response = await fetch('/api/saas/marketplace');
        if (response.ok) {
          const data = await response.json();
          setPlugins(data.plugins || []);
        }
      } catch (error) {
        console.error('Failed to fetch marketplace:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketplace();
  }, []);

  const pluginsToShow = plugins.filter((p) => !installedIds.includes(p.id));

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return `$${(price / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Plugin Marketplace</h3>
          <p className="text-sm text-muted-foreground">
            Browse and install plugins to extend functionality
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {pluginsToShow.map((plugin) => {
            const isFree = plugin.tiers.length === 1 && plugin.tiers[0].price_monthly === 0;
            const hasPricing = plugin.tiers.length > 0;

            return (
              <Card key={plugin.id} className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-3">
                    {plugin.icon && (
                      <div className="text-3xl flex-shrink-0">{plugin.icon}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{plugin.name}</CardTitle>
                        {plugin.featured === 1 && (
                          <Badge variant="secondary" className="text-xs">
                            Featured
                          </Badge>
                        )}
                        {isFree && (
                          <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                            Free
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1 line-clamp-2 text-sm">
                        {plugin.description}
                      </CardDescription>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span className="font-medium">v{plugin.version}</span>
                        <span>•</span>
                        <span>by {plugin.author}</span>
                        {plugin.category && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs font-normal">
                              {plugin.category}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col pt-0 px-6 pb-6">
                  {hasPricing && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold mb-2 text-muted-foreground">
                        {plugin.tiers.length === 1 ? 'Plan' : 'Pricing Plans'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {plugin.tiers.slice(0, 3).map((tier) => {
                          const isFreeTier = tier.price_monthly === 0 && tier.price_yearly === null && tier.price_lifetime === null;
                          return (
                            <Badge
                              key={tier.tier_id}
                              variant={isFreeTier ? "default" : "outline"}
                              className="text-xs"
                            >
                              {tier.name}
                              {!isFreeTier && (
                                <span className="ml-1">
                                  {tier.price_lifetime ? ` (${formatPrice(tier.price_lifetime)})` :
                                   tier.price_yearly ? ` (${formatPrice(tier.price_yearly)}/yr)` :
                                   tier.price_monthly ? ` (${formatPrice(tier.price_monthly)}/mo)` : ''}
                                </span>
                              )}
                            </Badge>
                          );
                        })}
                        {plugin.tiers.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{plugin.tiers.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedPlugin(plugin)}
                    >
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
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
                          Install
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pluginsToShow.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Download className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Plugins Available</h3>
              <p className="text-muted-foreground">
                All available plugins are already installed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plugin Details Dialog */}
      <Dialog open={selectedPlugin !== null} onOpenChange={() => setSelectedPlugin(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-3">
              {selectedPlugin?.icon && (
                <div className="text-4xl flex-shrink-0">{selectedPlugin.icon}</div>
              )}
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-2xl pr-8">{selectedPlugin?.name}</DialogTitle>
                <DialogDescription className="mt-1">
                  {selectedPlugin?.description}
                </DialogDescription>
                <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-muted-foreground">
                  <span>Version {selectedPlugin?.version}</span>
                  <span>•</span>
                  <span>by {selectedPlugin?.author}</span>
                  {selectedPlugin?.category && (
                    <>
                      <span>•</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {selectedPlugin.category}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {selectedPlugin?.tiers && selectedPlugin.tiers.length > 0 && (
              <div>
                <h4 className="font-semibold mb-4 text-base">
                  {selectedPlugin.tiers.length === 1 ? 'Available Plan' : 'Choose Your Plan'}
                </h4>
                <div className="grid gap-4 grid-cols-1">
                  {selectedPlugin.tiers.map((tier) => {
                    const isFree = tier.price_monthly === 0 && tier.price_yearly === null && tier.price_lifetime === null;
                    const hasTrial = tier.trial_days > 0;

                    return (
                      <Card key={tier.tier_id} className={isFree ? 'border-green-200 bg-green-50/50' : ''}>
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h5 className="font-semibold text-base flex items-center gap-2">
                                    {tier.name}
                                    {isFree && (
                                      <Badge className="bg-green-600 hover:bg-green-700">Free</Badge>
                                    )}
                                    {hasTrial && (
                                      <Badge variant="secondary">{tier.trial_days}-day trial</Badge>
                                    )}
                                  </h5>
                                  <div className="mt-1">
                                    {isFree ? (
                                      <span className="text-2xl font-bold text-green-700">Free</span>
                                    ) : (
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold">
                                          {formatPrice(tier.price_monthly || tier.price_yearly || tier.price_lifetime)}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                          {tier.price_monthly ? '/month' : tier.price_yearly ? '/year' : 'one-time'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <p className="text-sm font-medium mb-2">Features:</p>
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                  {tier.features.map((feature, idx) => (
                                    <li key={idx} className="text-sm flex items-start gap-2">
                                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                      <span className="text-muted-foreground">{feature}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="sm:w-32 flex-shrink-0">
                              <Button
                                className="w-full"
                                size="sm"
                                onClick={() => {
                                  onInstall(selectedPlugin.id);
                                  setSelectedPlugin(null);
                                }}
                                disabled={loadingPluginId === selectedPlugin.id}
                              >
                                {loadingPluginId === selectedPlugin.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isFree ? (
                                  <>Install Free</>
                                ) : (
                                  <>Select Plan</>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPlugin(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Dependencies Tab
// -----------------------------------------------------------------------------

function Dependencies({ manifests, states }: { manifests: (BackendPlugin | PluginManifest)[]; states: PluginState[] }) {
  const isPluginManifest = (m: BackendPlugin | PluginManifest): m is PluginManifest => {
    return 'dependencies' in m;
  };

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

            const dependencies = isPluginManifest(manifest) ? (manifest.dependencies || []) : [];
            const dependents = manifests.filter((m) =>
              isPluginManifest(m) && m.dependencies?.some((d) => d.pluginId === manifest.id)
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

interface BackendPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}

export function AdminPlugins() {
	const { tenant } = useAuth();
	const [backendPlugins, setBackendPlugins] = useState<BackendPlugin[]>([]);
	const [backendStates, setBackendStates] = useState<PluginState[]>([]);
	const [loadingStates, setLoadingStates] = useState(true);
	const [configurePluginId, setConfigurePluginId] = useState<string | null>(null);
	const [loading, setLoading] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState('installed');

  // Fetch plugins and states from backend API
  const fetchBackendData = async () => {
    try {
      const response = await fetch('/api/plugins');
      if (response.ok) {
        const data = await response.json();
        setBackendPlugins(data.plugins || []);
        setBackendStates(data.states || []);
      }
    } catch (error) {
      console.error('Failed to fetch plugin data:', error);
    } finally {
      setLoadingStates(false);
    }
  };

  useEffect(() => {
    fetchBackendData();
  }, []);

  const handleEnable = async (id: string) => {
    setLoading(id);
    try {
      const response = await fetch(`/api/plugins/enable`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pluginId: id }),
      });

      if (response.ok) {
        await fetchBackendData();
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
      const response = await fetch(`/api/plugins/disable`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pluginId: id }),
      });

      if (response.ok) {
        await fetchBackendData();
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
    setLoading(id);
    try {
      const response = await fetch(`/api/plugins/uninstall`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pluginId: id }),
      });

      if (response.ok) {
        await fetchBackendData();
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
      const response = await fetch(`/api/plugins/install`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pluginId: id }),
      });

      if (response.ok) {
        await fetchBackendData();
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
            {backendStates.length} plugin{backendStates.length !== 1 ? 's' : ''} installed
          </p>
        </div>
      </div>

      <Tabs defaultValue="installed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="installed">
            Installed ({backendStates.length})
          </TabsTrigger>
          <TabsTrigger value="marketplace">
            Marketplace
          </TabsTrigger>
          <TabsTrigger value="dependencies">
            Dependencies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed">
          {backendStates.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Puzzle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Plugins Installed</h3>
                  <p className="text-muted-foreground mb-4">
                    {tenant ? (
                      "Install plugins from the marketplace to get started."
                    ) : (
                      "Plugins are tenant-specific. Please access this page from your tenant subdomain (e.g., your-tenant.localhost:8787/admin/plugins)."
                    )}
                  </p>
                  {tenant && (
                    <Button onClick={() => setActiveTab('marketplace')}>
                      Browse Marketplace
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <InstalledPlugins
              manifests={backendPlugins}
              states={backendStates}
              onEnable={handleEnable}
              onDisable={handleDisable}
              onUninstall={handleUninstall}
              onConfigure={setConfigurePluginId}
              loadingPluginId={loading}
            />
          )}
        </TabsContent>

        <TabsContent value="marketplace">
          <Marketplace
            installedIds={backendStates.map((s) => s.id)}
            onInstall={handleInstall}
            loadingPluginId={loading}
          />
        </TabsContent>

        <TabsContent value="dependencies">
          <Dependencies manifests={backendPlugins} states={backendStates} />
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
