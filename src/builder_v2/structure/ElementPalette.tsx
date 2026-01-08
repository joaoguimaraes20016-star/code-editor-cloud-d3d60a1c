import {
  Type,
  Image,
  Video,
  Square,
  MousePointerClick,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateNodeId } from '../state/editorStore';
import type { CanvasNode } from '../types';

interface ElementConfig {
  type: string;
  label: string;
  icon: typeof Type;
  description: string;
  category: 'content' | 'media' | 'layout' | 'action';
}

const ELEMENT_CONFIG: ElementConfig[] = [
  // Content
  { type: 'text', label: 'Text', icon: Type, description: 'Add text content', category: 'content' },
  // Media
  { type: 'image', label: 'Image', icon: Image, description: 'Add an image', category: 'media' },
  { type: 'video', label: 'Video', icon: Video, description: 'Embed a video', category: 'media' },
  // Layout
  { type: 'container', label: 'Container', icon: Square, description: 'Group elements', category: 'layout' },
  { type: 'divider', label: 'Divider', icon: Minus, description: 'Visual separator', category: 'layout' },
  // Action
  { type: 'button', label: 'Button', icon: MousePointerClick, description: 'Add a button', category: 'action' },
];

const CATEGORIES = [
  { id: 'content', label: 'Content' },
  { id: 'media', label: 'Media' },
  { id: 'layout', label: 'Layout' },
  { id: 'action', label: 'Actions' },
];

interface ElementPaletteProps {
  onAddElement?: (element: CanvasNode) => void;
  compact?: boolean;
}

export function ElementPalette({ onAddElement, compact = false }: ElementPaletteProps) {

  const handleAddElement = (config: ElementConfig) => {
    const newNode: CanvasNode = {
      id: generateNodeId(config.type),
      type: config.type,
      props: getDefaultProps(config.type),
      children: [],
    };

    if (onAddElement) {
      onAddElement(newNode);
    }
  };

  return (
    <div className={cn("element-palette", compact && "element-palette--compact")}>
      {CATEGORIES.map((category) => {
        const elements = ELEMENT_CONFIG.filter((e) => e.category === category.id);
        if (elements.length === 0) return null;

        return (
          <div key={category.id} className="element-palette-category">
            <div className="element-palette-category-header">{category.label}</div>
            <div className="element-palette-grid">
              {elements.map((config) => {
                const Icon = config.icon;
                return (
                  <button
                    key={config.type}
                    type="button"
                    className="element-palette-item"
                    onClick={() => handleAddElement(config)}
                    title={config.description}
                  >
                    <div className="element-palette-icon">
                      <Icon size={16} />
                    </div>
                    <span className="element-palette-label">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getDefaultProps(type: string): Record<string, unknown> {
  switch (type) {
    case 'text':
      return { text: 'Add your text here...' };
    case 'image':
      return { src: '', alt: 'Image' };
    case 'video':
      return { src: '', autoplay: false };
    case 'container':
      return { gap: 12 };
    case 'divider':
      return { color: 'rgba(255,255,255,0.1)', thickness: 1 };
    case 'button':
      return { label: 'Click me', variant: 'primary' };
    default:
      return {};
  }
}
