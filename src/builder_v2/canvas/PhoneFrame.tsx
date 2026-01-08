import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
}

export function PhoneFrame({ children, className }: PhoneFrameProps) {
  return (
    <div className={cn("phone-frame", className)}>
      {/* Dynamic Island */}
      <div className="phone-notch">
        <div className="phone-notch-inner" />
      </div>
      
      {/* Screen Content */}
      <div className="phone-screen">
        <div className="phone-screen-content">
          {children}
        </div>
      </div>
      
      {/* Home Indicator */}
      <div className="phone-home-bar">
        <div className="phone-home-indicator" />
      </div>
    </div>
  );
}
