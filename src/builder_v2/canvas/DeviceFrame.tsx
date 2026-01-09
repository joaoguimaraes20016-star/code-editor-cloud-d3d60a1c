import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export const DEVICE_DIMENSIONS = {
  mobile: { width: 390, minHeight: 700 },
  tablet: { width: 768, minHeight: 560 },
  desktop: { width: 1024, minHeight: 560 },
} as const;

interface DeviceFrameProps {
  children: ReactNode;
  device: DeviceType;
  className?: string;
}

export function DeviceFrame({ children, device, className }: DeviceFrameProps) {
  if (device === 'desktop') {
    return (
      <div className={cn("device-frame--desktop", className)}>
        {/* Browser bar */}
        <div className="device-browser-bar">
          <div className="device-browser-dots">
            <span className="device-browser-dot device-browser-dot--red" />
            <span className="device-browser-dot device-browser-dot--yellow" />
            <span className="device-browser-dot device-browser-dot--green" />
          </div>
          <div className="device-browser-url">
            yourfunnel.com
          </div>
        </div>
        
        {/* Screen Content */}
        <div className="device-screen">
          <div className="device-screen-content">
            {children}
          </div>
        </div>
      </div>
    );
  }

  if (device === 'tablet') {
    return (
      <div className={cn("device-frame--tablet", className)}>
        {/* Screen Content */}
        <div className="device-screen">
          <div className="device-screen-content">
            {children}
          </div>
        </div>
        
        {/* Home Indicator */}
        <div className="device-home-bar">
          <div className="device-home-indicator" />
        </div>
      </div>
    );
  }

  // Mobile (default)
  return (
    <div className={cn("device-frame--phone", className)}>
      {/* Dynamic Island */}
      <div className="device-notch">
        <div className="device-notch-inner" />
      </div>
      
      {/* Screen Content */}
      <div className="device-screen">
        <div className="device-screen-content">
          {children}
        </div>
      </div>
      
      {/* Home Indicator */}
      <div className="device-home-bar">
        <div className="device-home-indicator" />
      </div>
    </div>
  );
}
