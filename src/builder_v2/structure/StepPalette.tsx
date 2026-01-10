import {
  Play,
  MessageSquare,
  List,
  Mail,
  Phone,
  UserCheck,
  Video,
  Code,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { STEP_DEFINITIONS } from '@/lib/funnel/stepDefinitions';

const STEP_TYPE_CONFIG = [
  { type: 'welcome', icon: Play, color: '#6366f1' },
  { type: 'text_question', icon: MessageSquare, color: '#8b5cf6' },
  { type: 'multi_choice', icon: List, color: '#a855f7' },
  { type: 'email_capture', icon: Mail, color: '#ec4899' },
  { type: 'phone_capture', icon: Phone, color: '#f43f5e' },
  { type: 'opt_in', icon: UserCheck, color: '#f97316' },
  { type: 'video', icon: Video, color: '#eab308' },
  { type: 'embed', icon: Code, color: '#22c55e' },
  { type: 'thank_you', icon: CheckCircle, color: '#14b8a6' },
] as const;

interface StepPaletteProps {
  onAddStep: (stepType: string) => void;
  compact?: boolean;
}

export function StepPalette({ onAddStep, compact = false }: StepPaletteProps) {
  return (
    <div className={cn("step-palette", compact && "step-palette--compact")}>
      <div className="step-palette-header">
        <span className="step-palette-title">Add Step</span>
      </div>
      <div className="step-palette-grid">
        {STEP_TYPE_CONFIG.map(({ type, icon: Icon, color }) => {
          const def = STEP_DEFINITIONS[type as keyof typeof STEP_DEFINITIONS];
          if (!def) return null;
          
          return (
            <button
              key={type}
              type="button"
              className="step-palette-item"
              onClick={() => onAddStep(type)}
              title={def.description}
            >
              <div
                className="step-palette-icon"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <Icon size={compact ? 16 : 20} />
              </div>
              <span className="step-palette-label">{def.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
