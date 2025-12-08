import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Monitor, Tablet, Smartphone } from 'lucide-react';

type DeviceType = 'mobile' | 'tablet' | 'desktop';

interface DevicePreviewProps {
  children: ReactNode;
  backgroundColor?: string;
  className?: string;
  device: DeviceType;
  onDeviceChange: (device: DeviceType) => void;
}

const DEVICE_DIMENSIONS = {
  mobile: { width: 390, minHeight: 700 },
  tablet: { width: 768, minHeight: 700 },
  desktop: { width: 1024, minHeight: 700 },
};

export function DevicePreview({ 
  children, 
  backgroundColor = '#0a0a0a', 
  className,
  device,
  onDeviceChange,
}: DevicePreviewProps) {
  const dimensions = DEVICE_DIMENSIONS[device];

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Device Switcher */}
      <div className="flex items-center gap-1 p-1 bg-card border border-border rounded-lg">
        <Button
          variant={device === 'mobile' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 px-3"
          onClick={() => onDeviceChange('mobile')}
        >
          <Smartphone className="h-4 w-4" />
        </Button>
        <Button
          variant={device === 'tablet' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 px-3"
          onClick={() => onDeviceChange('tablet')}
        >
          <Tablet className="h-4 w-4" />
        </Button>
        <Button
          variant={device === 'desktop' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 px-3"
          onClick={() => onDeviceChange('desktop')}
        >
          <Monitor className="h-4 w-4" />
        </Button>
      </div>

      {/* Device Frame */}
      <div 
        className={cn(
          "relative overflow-hidden shadow-2xl border-4 border-zinc-700/50 flex flex-col transition-all duration-300",
          device === 'mobile' && "rounded-[2.5rem]",
          device === 'tablet' && "rounded-[1.5rem]",
          device === 'desktop' && "rounded-lg"
        )}
        style={{ 
          width: dimensions.width, 
          minHeight: dimensions.minHeight,
          maxWidth: '100%',
          boxShadow: '0 25px 80px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Status bar area - only for mobile/tablet */}
        {device !== 'desktop' && (
          <div 
            className="flex-shrink-0 h-10 z-20 flex items-center justify-center"
            style={{ backgroundColor }}
          >
            <div className={cn(
              "bg-black/50 rounded-full",
              device === 'mobile' ? "w-24 h-6" : "w-16 h-4"
            )} />
          </div>
        )}

        {/* Content area */}
        <div 
          className="flex-1 w-full overflow-visible"
          style={{ backgroundColor }}
        >
          {children}
        </div>

        {/* Home indicator - only for mobile/tablet */}
        {device !== 'desktop' && (
          <div 
            className="flex-shrink-0 h-7 flex items-center justify-center z-20"
            style={{ backgroundColor }}
          >
            <div className={cn(
              "bg-white/25 rounded-full",
              device === 'mobile' ? "w-32 h-1.5" : "w-24 h-1"
            )} />
          </div>
        )}
      </div>
    </div>
  );
}
