import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface MobilePreviewProps {
  children: ReactNode;
  backgroundColor?: string;
  className?: string;
}

export function MobilePreview({ children, backgroundColor = '#0a0a0a', className }: MobilePreviewProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      {/* Simple mobile frame like Perspective */}
      <div 
        className="relative rounded-[2rem] overflow-hidden shadow-2xl border border-white/10"
        style={{ 
          width: 420, 
          height: 780,
          boxShadow: '0 25px 80px -12px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Status bar area */}
        <div 
          className="absolute top-0 left-0 right-0 h-10 z-20 flex items-center justify-center"
          style={{ backgroundColor }}
        >
          <div className="w-20 h-5 bg-black/40 rounded-full" />
        </div>

        {/* Content area */}
        <div 
          className="w-full h-full overflow-y-auto pt-10 pb-6"
          style={{ backgroundColor }}
        >
          {children}
        </div>

        {/* Home indicator */}
        <div 
          className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full z-20"
        />
      </div>
    </div>
  );
}