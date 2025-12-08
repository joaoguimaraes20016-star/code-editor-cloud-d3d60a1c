import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreviewNavigationProps {
  currentIndex: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}

export function PreviewNavigation({
  currentIndex,
  totalSteps,
  onPrevious,
  onNext,
  className,
}: PreviewNavigationProps) {
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalSteps - 1;

  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      {/* Previous Button */}
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border-border/50 hover:bg-background"
        onClick={onPrevious}
        disabled={!canGoPrevious}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      {/* Page Indicator */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              i === currentIndex 
                ? "bg-primary w-6" 
                : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>

      {/* Next Button */}
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border-border/50 hover:bg-background"
        onClick={onNext}
        disabled={!canGoNext}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
