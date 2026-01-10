/**
 * FontControl - Typography size and weight controls
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FontSizeControlProps {
  value: string;
  onChange: (value: string) => void;
}

const fontSizes = [
  { value: 'xs', label: 'XS (12px)' },
  { value: 'sm', label: 'SM (14px)' },
  { value: 'base', label: 'Base (16px)' },
  { value: 'lg', label: 'LG (18px)' },
  { value: 'xl', label: 'XL (20px)' },
  { value: '2xl', label: '2XL (24px)' },
  { value: '3xl', label: '3XL (30px)' },
  { value: '4xl', label: '4XL (36px)' },
];

export function FontSizeControl({ value, onChange }: FontSizeControlProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Size" />
      </SelectTrigger>
      <SelectContent>
        {fontSizes.map((size) => (
          <SelectItem key={size.value} value={size.value} className="text-xs">
            {size.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface FontWeightControlProps {
  value: string;
  onChange: (value: string) => void;
}

const fontWeights = [
  { value: 'normal', label: 'Regular' },
  { value: 'medium', label: 'Medium' },
  { value: 'semibold', label: 'Semibold' },
  { value: 'bold', label: 'Bold' },
];

export function FontWeightControl({ value, onChange }: FontWeightControlProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Weight" />
      </SelectTrigger>
      <SelectContent>
        {fontWeights.map((weight) => (
          <SelectItem key={weight.value} value={weight.value} className="text-xs">
            {weight.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface LineHeightControlProps {
  value: string;
  onChange: (value: string) => void;
}

const lineHeights = [
  { value: 'tight', label: 'Tight (1.2)' },
  { value: 'normal', label: 'Normal (1.5)' },
  { value: 'relaxed', label: 'Relaxed (1.75)' },
  { value: 'loose', label: 'Loose (2)' },
];

export function LineHeightControl({ value, onChange }: LineHeightControlProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Line Height" />
      </SelectTrigger>
      <SelectContent>
        {lineHeights.map((lh) => (
          <SelectItem key={lh.value} value={lh.value} className="text-xs">
            {lh.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
