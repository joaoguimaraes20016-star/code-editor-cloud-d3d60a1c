import React, { useState } from 'react';
import { Page, SelectionState, StepIntent, AIsuggestion, AICopilotProps } from '@/types/infostack';
import { cn } from '@/lib/utils';
import { 
  Sparkles, 
  Wand2, 
  MessageSquare, 
  ArrowRight, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  FileText,
  Layout,
  X
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface AIBuilderCopilotPanelProps extends AICopilotProps {
  isExpanded: boolean;
  onToggle: () => void;
}

// Mock suggestions based on context
const generateMockSuggestions = (page: Page, selection: SelectionState): AIsuggestion[] => {
  const suggestions: AIsuggestion[] = [];

  const stepIntents = page.steps.map(s => s.step_intent);
  if (!stepIntents.includes('qualify')) {
    suggestions.push({
      id: 'add-qualify',
      type: 'step',
      title: 'Add Qualification Step',
      description: 'Help filter leads with a quick quiz or question',
      confidence: 0.92,
    });
  }
  if (!stepIntents.includes('schedule') && stepIntents.includes('qualify')) {
    suggestions.push({
      id: 'add-schedule',
      type: 'step',
      title: 'Add Booking Step',
      description: 'Let qualified leads schedule a call',
      confidence: 0.88,
    });
  }

  if (selection.type === 'element') {
    suggestions.push({
      id: 'improve-copy',
      type: 'copy',
      title: 'Improve This Copy',
      description: 'Make it more engaging and conversion-focused',
      confidence: 0.85,
    });
  }

  if (selection.type === 'block' || selection.type === 'stack') {
    suggestions.push({
      id: 'optimize-layout',
      type: 'layout',
      title: 'Optimize Layout',
      description: 'Improve visual hierarchy and spacing',
      confidence: 0.78,
    });
  }

  suggestions.push({
    id: 'analyze-funnel',
    type: 'next-action',
    title: 'Analyze Funnel Flow',
    description: 'Get recommendations to improve conversion',
    confidence: 0.75,
  });

  return suggestions.slice(0, 3);
};

const suggestionIcons: Record<string, React.ReactNode> = {
  step: <Layout className="w-4 h-4" />,
  copy: <FileText className="w-4 h-4" />,
  layout: <Zap className="w-4 h-4" />,
  'next-action': <ArrowRight className="w-4 h-4" />,
};

export const AIBuilderCopilot: React.FC<AIBuilderCopilotPanelProps> = ({
  currentPage,
  selection,
  onApplySuggestion,
  isExpanded,
  onToggle,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const suggestions = generateMockSuggestions(currentPage, selection);

  const handleSubmitPrompt = async () => {
    if (!prompt.trim()) return;
    
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsProcessing(false);
    setPrompt('');
  };

  const handleApplySuggestion = (suggestion: AIsuggestion) => {
    setIsProcessing(true);
    setTimeout(() => {
      onApplySuggestion(suggestion);
      setIsProcessing(false);
    }, 800);
  };

  return (
    <div className={cn(
      'fixed bottom-6 left-6 w-72 bg-[hsl(var(--builder-surface))] border border-[hsl(var(--builder-border))] rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 z-40',
      isExpanded ? 'max-h-[500px]' : 'h-12'
    )}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-builder-surface hover:bg-builder-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg btn-gradient">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-builder-text">AI Copilot</span>
          <span className="px-1.5 py-0.5 text-[9px] font-medium bg-amber-500/20 text-amber-400 rounded-full">
            Demo
          </span>
          {isProcessing && (
            <Loader2 className="w-4 h-4 text-builder-accent animate-spin" />
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-builder-text-muted" />
        ) : (
          <ChevronUp className="w-4 h-4 text-builder-text-muted" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-builder-border-subtle animate-in">
          {/* Prompt Input */}
          <div className="p-3">
            <div className="relative">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask AI to help with your funnel..."
                className="builder-input resize-none pr-12 text-sm"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitPrompt();
                  }
                }}
              />
              <button
                onClick={handleSubmitPrompt}
                disabled={!prompt.trim() || isProcessing}
                className={cn(
                  'absolute right-2 bottom-2 p-2 rounded-lg transition-all',
                  prompt.trim() && !isProcessing
                    ? 'bg-builder-accent text-white hover:brightness-110'
                    : 'bg-builder-surface-active text-builder-text-dim'
                )}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Suggestions */}
          <div className="px-3 pb-3">
            <div className="text-xs text-builder-text-dim mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />
              Suggestions
            </div>
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleApplySuggestion(suggestion)}
                  disabled={isProcessing}
                  className={cn(
                    'w-full text-left p-3 rounded-xl bg-builder-surface border border-builder-border-subtle hover:border-builder-accent/40 hover:bg-builder-surface-hover transition-all group',
                    isProcessing && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-builder-surface-hover text-builder-accent group-hover:bg-builder-accent/10">
                      {suggestionIcons[suggestion.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-builder-text">
                        {suggestion.title}
                      </div>
                      <div className="text-xs text-builder-text-muted mt-0.5">
                        {suggestion.description}
                      </div>
                    </div>
                    <div className="text-xs text-builder-text-dim font-mono">
                      {Math.round(suggestion.confidence * 100)}%
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Context indicator */}
          {selection.id && (
            <div className="px-3 pb-3">
              <div className="text-xs text-builder-text-dim px-3 py-2 bg-builder-bg rounded-lg flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-builder-accent" />
                Context: <span className="text-builder-text-secondary capitalize">{selection.type}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};