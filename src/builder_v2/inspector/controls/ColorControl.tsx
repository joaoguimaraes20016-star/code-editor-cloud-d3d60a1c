/**
 * ColorControl - Framer-style color picker with presets
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ColorControlProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const COLOR_PRESETS = [
  // Whites & Grays
  '#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#475569', '#1e293b', '#0f172a',
  // Accent colors
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  // Warm colors
  '#f97316', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#22c55e',
  // Cool colors
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#4f46e5',
  // Transparent
  'transparent',
];

export function ColorControl({ value, onChange, label }: ColorControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 h-9"
        >
          <div
            className={cn(
              'w-5 h-5 rounded border border-slate-200 flex-shrink-0',
              value === 'transparent' && 'bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%278%27 height=%278%27%3E%3Crect width=%278%27 height=%278%27 fill=%27%23fff%27/%3E%3Crect width=%274%27 height=%274%27 fill=%27%23ccc%27/%3E%3Crect x=%274%27 y=%274%27 width=%274%27 height=%274%27 fill=%27%23ccc%27/%3E%3C/svg%3E")]'
            )}
            style={{ backgroundColor: value !== 'transparent' ? value : undefined }}
          />
          <span className="text-xs font-mono text-slate-600 truncate">
            {value || 'Select color'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-1.5">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-7 h-7 rounded-md border-2 transition-all hover:scale-110',
                  value === color
                    ? 'border-slate-900 ring-2 ring-slate-300'
                    : 'border-transparent',
                  color === 'transparent' && 'bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%278%27 height=%278%27%3E%3Crect width=%278%27 height=%278%27 fill=%27%23fff%27/%3E%3Crect width=%274%27 height=%274%27 fill=%27%23ccc%27/%3E%3Crect x=%274%27 y=%274%27 width=%274%27 height=%274%27 fill=%27%23ccc%27/%3E%3C/svg%3E")]'
                )}
                style={{ backgroundColor: color !== 'transparent' ? color : undefined }}
              />
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <Input
              type="color"
              value={value && value !== 'transparent' ? value : '#ffffff'}
              onChange={(e) => onChange(e.target.value)}
              className="w-10 h-8 p-0.5 cursor-pointer"
            />
            <Input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#ffffff"
              className="flex-1 h-8 text-xs font-mono"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
