/**
 * ShadowControl - Box shadow preset selector
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ShadowControlProps {
  value: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  onChange: (value: 'none' | 'sm' | 'md' | 'lg' | 'xl') => void;
}

const shadowPresets = [
  { value: 'none' as const, label: 'None', preview: 'shadow-none' },
  { value: 'sm' as const, label: 'S', preview: 'shadow-sm' },
  { value: 'md' as const, label: 'M', preview: 'shadow-md' },
  { value: 'lg' as const, label: 'L', preview: 'shadow-lg' },
  { value: 'xl' as const, label: 'XL', preview: 'shadow-xl' },
];

export function ShadowControl({ value, onChange }: ShadowControlProps) {
  return (
    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
      {shadowPresets.map((preset) => (
        <Button
          key={preset.value}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(preset.value)}
          className={cn(
            'flex-1 h-8 rounded-none border-r last:border-r-0 border-slate-200 text-xs font-medium',
            value === preset.value
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}
