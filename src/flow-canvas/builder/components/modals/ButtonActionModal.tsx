import React, { useState } from 'react';
import { 
  MousePointer2, 
  ExternalLink, 
  ArrowRight, 
  Hash, 
  Send, 
  Download, 
  Phone, 
  Mail,
  Layers,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ButtonActionType = 
  | 'next-step' 
  | 'go-to-step' 
  | 'url' 
  | 'scroll' 
  | 'submit' 
  | 'modal' 
  | 'download' 
  | 'phone' 
  | 'email';

export interface ButtonAction {
  type: ButtonActionType;
  value?: string;
  openNewTab?: boolean;
}

interface ButtonActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: ButtonAction | null;
  onSave: (action: ButtonAction) => void;
  steps?: { id: string; name: string }[];
}

interface ActionOption {
  type: ButtonActionType;
  label: string;
  icon: React.ReactNode;
  description: string;
  hasInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  hasNewTab?: boolean;
}

const actionOptions: ActionOption[] = [
  { 
    type: 'next-step', 
    label: 'Next Step', 
    icon: <ArrowRight className="w-4 h-4" />, 
    description: 'Go to the next step in the funnel' 
  },
  { 
    type: 'go-to-step', 
    label: 'Go to Step', 
    icon: <Layers className="w-4 h-4" />, 
    description: 'Jump to a specific step',
    hasInput: true,
    inputLabel: 'Select Step'
  },
  { 
    type: 'url', 
    label: 'Open URL', 
    icon: <ExternalLink className="w-4 h-4" />, 
    description: 'Navigate to an external URL',
    hasInput: true,
    inputLabel: 'URL',
    inputPlaceholder: 'https://example.com',
    hasNewTab: true
  },
  { 
    type: 'scroll', 
    label: 'Scroll to Section', 
    icon: <Hash className="w-4 h-4" />, 
    description: 'Scroll to an element on the page',
    hasInput: true,
    inputLabel: 'Element ID',
    inputPlaceholder: '#section-name'
  },
  { 
    type: 'submit', 
    label: 'Submit Form', 
    icon: <Send className="w-4 h-4" />, 
    description: 'Submit the current form' 
  },
  { 
    type: 'download', 
    label: 'Download File', 
    icon: <Download className="w-4 h-4" />, 
    description: 'Download a file',
    hasInput: true,
    inputLabel: 'File URL',
    inputPlaceholder: 'https://example.com/file.pdf'
  },
  { 
    type: 'phone', 
    label: 'Call Phone', 
    icon: <Phone className="w-4 h-4" />, 
    description: 'Start a phone call',
    hasInput: true,
    inputLabel: 'Phone Number',
    inputPlaceholder: '+1 (555) 123-4567'
  },
  { 
    type: 'email', 
    label: 'Send Email', 
    icon: <Mail className="w-4 h-4" />, 
    description: 'Open email client',
    hasInput: true,
    inputLabel: 'Email Address',
    inputPlaceholder: 'hello@example.com'
  },
];

export const ButtonActionModal: React.FC<ButtonActionModalProps> = ({
  isOpen,
  onClose,
  action,
  onSave,
  steps = [],
}) => {
  const [selectedType, setSelectedType] = useState<ButtonActionType>(action?.type || 'next-step');
  const [inputValue, setInputValue] = useState(action?.value || '');
  const [openNewTab, setOpenNewTab] = useState(action?.openNewTab || false);

  const selectedOption = actionOptions.find(o => o.type === selectedType);

  const handleSave = () => {
    onSave({
      type: selectedType,
      value: inputValue || undefined,
      openNewTab: openNewTab || undefined,
    });
    onClose();
  };

  const handleTypeSelect = (type: ButtonActionType) => {
    setSelectedType(type);
    setInputValue('');
    setOpenNewTab(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-builder-surface border-builder-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-builder-text flex items-center gap-2">
            <MousePointer2 className="w-5 h-5 text-builder-accent" />
            Button Click Action
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action Type Grid */}
          <div className="grid grid-cols-2 gap-2">
            {actionOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => handleTypeSelect(option.type)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  selectedType === option.type
                    ? 'border-builder-accent bg-builder-accent/10'
                    : 'border-builder-border hover:border-builder-text-muted hover:bg-builder-surface-hover'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    selectedType === option.type ? 'text-builder-accent' : 'text-builder-text-muted'
                  )}>
                    {option.icon}
                  </span>
                  <span className={cn(
                    'text-sm font-medium',
                    selectedType === option.type ? 'text-builder-accent' : 'text-builder-text'
                  )}>
                    {option.label}
                  </span>
                </div>
                <p className="text-xs text-builder-text-muted line-clamp-1">
                  {option.description}
                </p>
              </button>
            ))}
          </div>

          {/* Input Field */}
          {selectedOption?.hasInput && (
            <div className="space-y-2">
              <Label className="text-sm text-builder-text-muted">
                {selectedOption.inputLabel}
              </Label>
              {selectedOption.type === 'go-to-step' ? (
                <Select value={inputValue} onValueChange={setInputValue}>
                  <SelectTrigger className="builder-input">
                    <SelectValue placeholder="Select a step..." />
                  </SelectTrigger>
                  <SelectContent className="bg-builder-surface border-builder-border">
                    {steps.map((step) => (
                      <SelectItem key={step.id} value={step.id}>
                        {step.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={selectedOption.inputPlaceholder}
                  className="builder-input"
                />
              )}
            </div>
          )}

          {/* New Tab Toggle */}
          {selectedOption?.hasNewTab && (
            <div className="flex items-center justify-between py-2">
              <Label className="text-sm text-builder-text">Open in new tab</Label>
              <Switch
                checked={openNewTab}
                onCheckedChange={setOpenNewTab}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-builder-text-muted hover:text-builder-text"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-builder-accent text-white hover:brightness-110"
            >
              Save Action
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
