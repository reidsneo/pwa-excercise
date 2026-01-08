// =============================================================================
// UPGRADE PROMPT COMPONENT
// =============================================================================

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Lock, ArrowRight } from 'lucide-react';

interface FeatureTier {
  tier_id: string;
  name: string;
  features: string[];
  price_monthly?: number;
  price_yearly?: number;
  price_lifetime?: number;
}

interface PluginInfo {
  id: string;
  name: string;
  description: string;
  tiers: FeatureTier[];
}

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  pluginId: string;
  pluginName: string;
  feature: string;
  currentTier?: string;
  onUpgrade?: (tierId: string) => void;
}

export function UpgradePrompt({
  isOpen,
  onClose,
  pluginId,
  pluginName,
  feature,
  currentTier,
  onUpgrade,
}: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);
  const [pluginInfo, setPluginInfo] = useState<PluginInfo | null>(null);

  // Fetch plugin info when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setPluginInfo(null);
      return;
    }

    // Fetch plugin marketplace info
    const fetchPluginInfo = async () => {
      try {
        const response = await fetch('/api/saas/marketplace');
        if (response.ok) {
          const data = await response.json();
          const plugin = data.plugins?.find((p: PluginInfo) => p.id === pluginId);
          if (plugin) {
            setPluginInfo(plugin);
          }
        }
      } catch (error) {
        console.error('Failed to fetch plugin info:', error);
      }
    };

    fetchPluginInfo();
  };

  const handleUpgrade = async (tierId: string) => {
    if (onUpgrade) {
      setLoading(true);
      try {
        await onUpgrade(tierId);
      } finally {
        setLoading(false);
      }
    } else {
      // Default behavior: redirect to plugins page
      window.location.href = '/admin/plugins';
    }
  };

  const getUpgradeTarget = () => {
    if (!pluginInfo || !currentTier) return null;

    // Find the tier that has the required feature
    const currentTierIndex = pluginInfo.tiers.findIndex((t) => t.tier_id === currentTier);
    const upgradeTier = pluginInfo.tiers
      .slice(currentTierIndex + 1)
      .find((t) => t.features.includes(feature));

    return upgradeTier || pluginInfo.tiers[pluginInfo.tiers.length - 1];
  };

  const upgradeTarget = getUpgradeTarget();

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-muted-foreground" />
            Upgrade Required
          </DialogTitle>
          <DialogDescription>
            The feature <strong>"{feature}"</strong> requires a higher tier subscription for{' '}
            <strong>{pluginName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {pluginInfo && upgradeTarget && (
          <div className="py-4">
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Upgrade to</span>
                <Badge variant="default">{upgradeTarget.name}</Badge>
              </div>

              {upgradeTarget.price_monthly !== undefined && (
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    ${upgradeTarget.price_monthly}
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </p>
                  {upgradeTarget.price_yearly && (
                    <p className="text-xs text-muted-foreground">
                      or ${upgradeTarget.price_yearly}/year (save ${Math.round(
                        ((upgradeTarget.price_monthly! * 12 - upgradeTarget.price_yearly!) /
                          (upgradeTarget.price_monthly! * 12)) *
                          100
                      )}
                      %)
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">This tier includes:</p>
                <ul className="space-y-1">
                  {upgradeTarget.features.slice(0, 3).map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="capitalize">{f.replace(/\./g, ' ')}</span>
                    </li>
                  ))}
                  {upgradeTarget.features.length > 3 && (
                    <li className="text-sm text-muted-foreground">
                      +{upgradeTarget.features.length - 3} more features
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={() => upgradeTarget && handleUpgrade(upgradeTarget.tier_id)}
            disabled={loading || !upgradeTarget}
            className="w-full"
          >
            {loading ? 'Processing...' : 'Upgrade Now'}
            {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full">
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook to show upgrade prompt
export function useUpgradePrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [promptData, setPromptData] = useState<{
    pluginId: string;
    pluginName: string;
    feature: string;
    currentTier?: string;
  } | null>(null);

  const showUpgradePrompt = (data: {
    pluginId: string;
    pluginName: string;
    feature: string;
    currentTier?: string;
  }) => {
    setPromptData(data);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setPromptData(null);
  };

  const UpgradePromptComponent = promptData ? (
    <UpgradePrompt
      isOpen={isOpen}
      onClose={handleClose}
      pluginId={promptData.pluginId}
      pluginName={promptData.pluginName}
      feature={promptData.feature}
      currentTier={promptData.currentTier}
    />
  ) : null;

  return {
    showUpgradePrompt,
    UpgradePromptComponent,
    isOpen,
  };
}
