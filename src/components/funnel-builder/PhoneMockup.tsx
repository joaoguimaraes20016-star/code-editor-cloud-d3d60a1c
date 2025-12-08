import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface PhoneMockupProps {
  children: ReactNode;
  backgroundColor?: string;
  className?: string;
}

export function PhoneMockup({ children, backgroundColor = '#0a0a0a', className }: PhoneMockupProps) {
  return (
    <div className={cn("flex items-center justify-center p-4", className)}>
      {/* iPhone Frame */}
      <div 
        className="relative rounded-[3rem] p-3 shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {/* Side buttons */}
        <div className="absolute -left-1 top-24 w-1 h-8 bg-zinc-700 rounded-l-sm" />
        <div className="absolute -left-1 top-36 w-1 h-12 bg-zinc-700 rounded-l-sm" />
        <div className="absolute -left-1 top-52 w-1 h-12 bg-zinc-700 rounded-l-sm" />
        <div className="absolute -right-1 top-32 w-1 h-16 bg-zinc-700 rounded-r-sm" />

        {/* Screen bezel */}
        <div 
          className="relative rounded-[2.25rem] overflow-hidden"
          style={{ width: 280, height: 606 }}
        >
          {/* Dynamic Island */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
            <div 
              className="w-24 h-7 bg-black rounded-full flex items-center justify-center gap-2"
              style={{ boxShadow: 'inset 0 0 8px rgba(0,0,0,0.5)' }}
            >
              <div className="w-2 h-2 rounded-full bg-zinc-800" />
            </div>
          </div>

          {/* Screen content */}
          <div 
            className="w-full h-full overflow-y-auto"
            style={{ backgroundColor }}
          >
            {children}
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full z-20" />
        </div>
      </div>
    </div>
  );
}
