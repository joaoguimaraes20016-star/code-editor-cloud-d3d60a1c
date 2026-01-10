/**
 * AlignmentControl - Framer-style alignment buttons
 */

import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AlignmentControlProps {
  value: 'left' | 'center' | 'right' | 'justify';
  onChange: (value: 'left' | 'center' | 'right' | 'justify') => void;
  showJustify?: boolean;
}

const alignments = [
  { value: 'left' as const, icon: AlignLeft },
  { value: 'center' as const, icon: AlignCenter },
  { value: 'right' as const, icon: AlignRight },
  { value: 'justify' as const, icon: AlignJustify },
];

export function AlignmentControl({ value, onChange, showJustify = false }: AlignmentControlProps) {
  const options = showJustify ? alignments : alignments.slice(0, 3);

  return (
    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <Button
            key={opt.value}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 h-8 rounded-none border-r last:border-r-0 border-slate-200',
              value === opt.value
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon size={14} />
          </Button>
        );
      })}
    </div>
  );
}
