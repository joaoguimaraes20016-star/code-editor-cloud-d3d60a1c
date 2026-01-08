/**
 * TemplatePreviewCard - Visual thumbnail preview of section templates
 * Shows a scaled-down miniature of the actual template
 */

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectionTemplate } from '../templates/sectionTemplates';

interface TemplatePreviewCardProps {
  template: SectionTemplate;
  onAdd: () => void;
}

export function TemplatePreviewCard({ template, onAdd }: TemplatePreviewCardProps) {
  return (
    <button
      onClick={onAdd}
      className="group relative w-full rounded-lg border border-slate-200 bg-white overflow-hidden transition-all hover:border-primary/50 hover:shadow-md"
    >
      {/* Preview area */}
      <div className="relative h-24 bg-gradient-to-br from-slate-900 to-slate-800 p-3 overflow-hidden">
        <TemplatePreview template={template} />
        
        {/* Hover overlay with add button */}
        <div className="absolute inset-0 bg-primary/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
            <Plus size={16} className="text-primary" />
          </div>
        </div>
      </div>
      
      {/* Template name */}
      <div className="px-2 py-1.5 text-center">
        <span className="text-[11px] font-medium text-slate-600 truncate block">
          {template.name}
        </span>
      </div>
    </button>
  );
}

// Visual preview of different template types
function TemplatePreview({ template }: { template: SectionTemplate }) {
  const { category, id } = template;

  // Hero templates
  if (category === 'hero') {
    return (
      <div className="space-y-2">
        <div className="h-2.5 w-24 bg-white/90 rounded" />
        <div className="h-1.5 w-20 bg-white/50 rounded" />
        {id.includes('button') && (
          <div className="h-3 w-12 bg-blue-500 rounded-sm mt-2" />
        )}
      </div>
    );
  }

  // Content templates
  if (category === 'content') {
    return (
      <div className="space-y-1.5">
        {id.includes('heading') && (
          <div className="h-2 w-16 bg-white/80 rounded" />
        )}
        <div className="space-y-1">
          <div className="h-1 w-full bg-white/40 rounded" />
          <div className="h-1 w-4/5 bg-white/40 rounded" />
          <div className="h-1 w-3/4 bg-white/40 rounded" />
        </div>
      </div>
    );
  }

  // CTA templates
  if (category === 'cta') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        {id.includes('text') && (
          <div className="h-1.5 w-20 bg-white/50 rounded" />
        )}
        <div className="h-4 w-16 bg-blue-500 rounded-sm" />
      </div>
    );
  }

  // Media templates
  if (category === 'media') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className={cn(
          "rounded bg-white/20 flex items-center justify-center",
          id.includes('video') ? "w-16 h-10" : "w-14 h-10"
        )}>
          {id.includes('video') ? (
            <div className="w-4 h-4 border-l-4 border-t-2 border-b-2 border-white/60 border-l-white/60 border-t-transparent border-b-transparent" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-white/40" />
          )}
        </div>
      </div>
    );
  }

  // Form templates
  if (category === 'form') {
    if (id.includes('multi-choice')) {
      return (
        <div className="grid grid-cols-2 gap-1.5 p-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 rounded bg-white/10 border border-white/30" />
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-1.5 py-2">
        {id.includes('full') && (
          <div className="h-3 w-full rounded bg-white/10 border border-white/20" />
        )}
        <div className="h-3 w-full rounded bg-white/10 border border-white/20" />
        {id.includes('full') && (
          <div className="h-3 w-full rounded bg-white/10 border border-white/20" />
        )}
        {id.includes('optin') && (
          <div className="h-3.5 w-14 bg-blue-500 rounded-sm mt-1 mx-auto" />
        )}
      </div>
    );
  }

  // Social proof / features
  if (category === 'social_proof' || category === 'features') {
    return (
      <div className="space-y-1.5">
        {category === 'features' && (
          <div className="h-2 w-14 bg-white/70 rounded mb-1" />
        )}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400/70" />
            <div className="h-1 w-16 bg-white/40 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Default fallback
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 rounded bg-white/20" />
    </div>
  );
}
