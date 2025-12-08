import { cn } from '@/lib/utils';
import { ReactNode, useRef } from 'react';

interface MobilePreviewProps {
  children: ReactNode;
  backgroundColor?: string;
  className?: string;
}

export function MobilePreview({ children, backgroundColor = '#0a0a0a', className }: MobilePreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Perspective-style mobile frame - larger and simpler */}
      <div 
        className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-zinc-700/50 flex flex-col"
        style={{ 
          width: 440, 
          minHeight: 700,
          maxHeight: 'none', // Allow unlimited height
          boxShadow: '0 25px 80px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Status bar area */}
        <div 
          className="flex-shrink-0 h-12 z-20 flex items-center justify-center"
          style={{ backgroundColor }}
        >
          <div className="w-24 h-6 bg-black/50 rounded-full" />
        </div>

        {/* Content area - NO height limit, grows with content */}
        <div 
          ref={contentRef}
          className="flex-1 w-full overflow-visible"
          style={{ 
            backgroundColor,
          }}
        >
          {children}
        </div>

        {/* Home indicator */}
        <div 
          className="flex-shrink-0 h-8 flex items-center justify-center z-20"
          style={{ backgroundColor }}
        >
          <div className="w-36 h-1.5 bg-white/25 rounded-full" />
        </div>
      </div>
    </div>
  );
}