import React from 'react';
import { Layers, Droplet, Palette, CircleDot } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface Overlay {
  id: string;
  name: string;
  icon: React.ReactNode;
  preview: string; // CSS background
}

const overlays: Overlay[] = [
  { 
    id: 'gradient-dark', 
    name: 'Dark Gradient', 
    icon: <Layers className="w-4 h-4" />,
    preview: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)'
  },
  { 
    id: 'gradient-light', 
    name: 'Light Gradient', 
    icon: <Layers className="w-4 h-4" />,
    preview: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, transparent 100%)'
  },
  { 
    id: 'blur', 
    name: 'Blur', 
    icon: <Droplet className="w-4 h-4" />,
    preview: 'rgba(255,255,255,0.3)'
  },
  { 
    id: 'color-black', 
    name: 'Black Overlay', 
    icon: <Palette className="w-4 h-4" />,
    preview: 'rgba(0,0,0,0.5)'
  },
  { 
    id: 'color-white', 
    name: 'White Overlay', 
    icon: <Palette className="w-4 h-4" />,
    preview: 'rgba(255,255,255,0.5)'
  },
  { 
    id: 'vignette', 
    name: 'Vignette', 
    icon: <CircleDot className="w-4 h-4" />,
    preview: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)'
  },
];

interface OverlayPickerPopoverProps {
  children: React.ReactNode;
  onSelectOverlay: (overlayId: string, opacity?: number) => void;
  currentOverlay?: string;
}

export const OverlayPickerPopover: React.FC<OverlayPickerPopoverProps> = ({
  children,
  onSelectOverlay,
  currentOverlay,
}) => {
  const [opacity, setOpacity] = React.useState(50);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 bg-builder-surface border-builder-border">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-2 border-b border-builder-border">
          <Layers className="w-4 h-4 text-builder-accent" />
          <span className="text-sm font-medium text-builder-text">Add Overlay</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mb-3">
          {overlays.map((overlay) => (
            <button
              key={overlay.id}
              onClick={() => onSelectOverlay(overlay.id, opacity)}
              className={cn(
                'flex flex-col items-center gap-2 p-3 rounded-lg transition-all border-2',
                currentOverlay === overlay.id
                  ? 'border-builder-accent bg-builder-accent/10'
                  : 'border-transparent hover:bg-builder-surface-hover'
              )}
            >
              <div 
                className="w-full h-12 rounded-md border border-builder-border"
                style={{ background: overlay.preview }}
              />
              <span className="text-xs text-builder-text">{overlay.name}</span>
            </button>
          ))}
        </div>

        <div className="px-2 py-3 border-t border-builder-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-builder-text-muted">Opacity</span>
            <span className="text-xs text-builder-text font-mono">{opacity}%</span>
          </div>
          <Slider
            value={[opacity]}
            onValueChange={([value]) => {
              setOpacity(value);
              // Emit opacity change if an overlay is already selected
              if (currentOverlay) {
                onSelectOverlay(currentOverlay, value);
              }
            }}
            max={100}
            step={5}
            className="w-full"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};
