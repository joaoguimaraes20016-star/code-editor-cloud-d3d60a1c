import React, { useState } from 'react';
import { Sparkles, Wand2, Loader2, Lightbulb } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Block } from '@/types/infostack';
import { generateId } from '../../utils/helpers';
import { toast } from 'sonner';

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateBlock: (block: Block) => void;
}

const suggestions = [
  'Create a hero section with a headline and call-to-action',
  'Generate a testimonials section with 3 customer quotes',
  'Build a pricing table with 3 tiers',
  'Create a FAQ section with 5 common questions',
  'Design a feature grid highlighting 4 key benefits',
];

export const AIGenerateModal: React.FC<AIGenerateModalProps> = ({
  isOpen,
  onClose,
  onGenerateBlock,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    
    // Simulate AI generation (in real app, this would call an API)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate a mock block based on the prompt
    const block: Block = {
      id: generateId(),
      type: 'text-block',
      label: 'AI Generated Block',
      elements: [
        {
          id: generateId(),
          type: 'heading',
          content: 'AI Generated Content',
          props: { level: 2 },
        },
        {
          id: generateId(),
          type: 'text',
          content: `This block was generated based on your prompt: "${prompt}". In a production environment, this would be replaced with actual AI-generated content.`,
          props: {},
        },
        {
          id: generateId(),
          type: 'button',
          content: 'Learn More',
          props: {},
        },
      ],
      props: {},
    };

    onGenerateBlock(block);
    setIsGenerating(false);
    setPrompt('');
    toast.success('Block generated successfully!');
    onClose();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-builder-surface border-builder-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-builder-text flex items-center gap-2">
            <div className="p-1.5 rounded-lg btn-gradient">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            Generate with AI
            <span className="ml-2 px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded-full">
              Demo
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-builder-text">
              Describe what you want to create
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., Create a hero section with a bold headline, supporting text, and a call-to-action button..."
              className="builder-input resize-none"
              rows={4}
            />
          </div>

          {/* Suggestions */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-builder-text-muted">
              <Lightbulb className="w-3.5 h-3.5" />
              Try these prompts
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full bg-[hsl(var(--builder-surface-hover))] border border-[hsl(var(--builder-border-subtle))] text-builder-text-secondary hover:bg-builder-accent/10 hover:text-builder-accent hover:border-builder-accent/30 transition-colors"
                >
                  {suggestion.length > 40 ? suggestion.slice(0, 40) + '...' : suggestion}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="w-full bg-gradient-to-r from-builder-accent to-intent-qualify text-white hover:brightness-110"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Block
              </>
            )}
          </Button>

          <p className="text-xs text-builder-text-dim text-center">
            AI generation uses credits from your account
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
