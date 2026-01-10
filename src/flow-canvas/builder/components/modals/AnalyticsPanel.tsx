import React from 'react';
import { BarChart3, TrendingUp, Users, Clock, ArrowUpRight, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AnalyticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const mockStats = [
    { label: 'Page Views', value: '0', icon: <Users className="w-5 h-5" />, change: null },
    { label: 'Avg. Time', value: '--', icon: <Clock className="w-5 h-5" />, change: null },
    { label: 'Conversion', value: '--', icon: <TrendingUp className="w-5 h-5" />, change: null },
    { label: 'Bounces', value: '--', icon: <ArrowUpRight className="w-5 h-5" />, change: null },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-builder-surface border-builder-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-builder-text flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-builder-accent" />
            Analytics
            <span className="ml-2 px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded-full">
              Demo
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {mockStats.map((stat, index) => (
              <div
                key={index}
                className="p-4 bg-builder-bg border border-builder-border rounded-xl"
              >
                <div className="flex items-center gap-2 text-builder-text-muted mb-2">
                  {stat.icon}
                  <span className="text-xs">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-builder-text">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* No Data State */}
          <div className="text-center py-6 border border-dashed border-builder-border rounded-xl">
            <BarChart3 className="w-10 h-10 text-builder-text-dim mx-auto mb-3" />
            <p className="text-sm font-medium text-builder-text mb-1">No analytics data yet</p>
            <p className="text-xs text-builder-text-muted mb-4">
              Publish your page to start collecting analytics
            </p>
          </div>

          {/* Connect Analytics */}
          <div className="space-y-3">
            <p className="text-xs text-builder-text-muted text-center">
              Want more detailed analytics?
            </p>
            <Button
              variant="outline"
              disabled
              className="w-full border-builder-border text-builder-text-muted cursor-not-allowed opacity-60"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Google Analytics Integration Coming Soon
            </Button>
            <p className="text-[10px] text-builder-text-dim text-center">
              We're working on built-in analytics. Stay tuned!
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
