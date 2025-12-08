import { cn } from '@/lib/utils';

interface ProgressDotsProps {
  total: number;
  current: number;
  primaryColor: string;
}

export function ProgressDots({ total, current, primaryColor }: ProgressDotsProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'w-2 h-2 rounded-full transition-all duration-300',
            index === current ? 'scale-125' : 'scale-100'
          )}
          style={{
            backgroundColor: index <= current ? primaryColor : 'rgba(255,255,255,0.3)',
          }}
        />
      ))}
    </div>
  );
}
