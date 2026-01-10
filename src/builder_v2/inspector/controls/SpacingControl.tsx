/**
 * SpacingControl - 4-way padding/margin control
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Link2, Unlink2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface SpacingControlProps {
  value: SpacingValue;
  onChange: (value: SpacingValue) => void;
  label?: string;
  max?: number;
}

export function SpacingControl({ value, onChange, label, max = 100 }: SpacingControlProps) {
  const [linked, setLinked] = useState(
    value.top === value.right && value.right === value.bottom && value.bottom === value.left
  );

  const handleChange = (side: keyof SpacingValue, val: number) => {
    if (linked) {
      onChange({ top: val, right: val, bottom: val, left: val });
    } else {
      onChange({ ...value, [side]: val });
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs font-medium text-slate-600">{label}</Label>}
      <div className="relative">
        {/* Visual spacing box */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-slate-50 rounded-lg border border-slate-200">
          {/* Top */}
          <div className="col-start-2">
            <Input
              type="number"
              value={value.top}
              onChange={(e) => handleChange('top', Math.min(max, Math.max(0, parseInt(e.target.value) || 0)))}
              className="h-7 text-xs text-center"
              min={0}
              max={max}
            />
          </div>

          {/* Left */}
          <div className="col-start-1 row-start-2">
            <Input
              type="number"
              value={value.left}
              onChange={(e) => handleChange('left', Math.min(max, Math.max(0, parseInt(e.target.value) || 0)))}
              className="h-7 text-xs text-center"
              min={0}
              max={max}
            />
          </div>

          {/* Center link button */}
          <div className="col-start-2 row-start-2 flex items-center justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLinked(!linked)}
              className={cn(
                'h-7 w-7 p-0',
                linked ? 'text-indigo-600' : 'text-slate-400'
              )}
            >
              {linked ? <Link2 size={14} /> : <Unlink2 size={14} />}
            </Button>
          </div>

          {/* Right */}
          <div className="col-start-3 row-start-2">
            <Input
              type="number"
              value={value.right}
              onChange={(e) => handleChange('right', Math.min(max, Math.max(0, parseInt(e.target.value) || 0)))}
              className="h-7 text-xs text-center"
              min={0}
              max={max}
            />
          </div>

          {/* Bottom */}
          <div className="col-start-2 row-start-3">
            <Input
              type="number"
              value={value.bottom}
              onChange={(e) => handleChange('bottom', Math.min(max, Math.max(0, parseInt(e.target.value) || 0)))}
              className="h-7 text-xs text-center"
              min={0}
              max={max}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
