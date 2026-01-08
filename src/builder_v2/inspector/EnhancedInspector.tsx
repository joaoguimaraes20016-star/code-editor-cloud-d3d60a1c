import { useState, useCallback } from 'react';
import { 
  Type, 
  Palette, 
  Layout, 
  Settings,
  Plus,
  Trash2,
  GripVertical,
  RotateCcw,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Link,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '../state/editorStore';
import { ComponentRegistry, fallbackComponent } from '../registry/componentRegistry';
import type { CanvasNode, LayoutPersonality } from '../types';
import './enhanced-inspector.css';

type InspectorTab = 'content' | 'style' | 'layout';

// Find node by ID in tree
function findNodeById(node: CanvasNode, nodeId: string): CanvasNode | null {
  if (node.id === nodeId) return node;
  for (const child of node.children) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

// Color presets - expanded palette
const COLOR_PRESETS = [
  '#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#64748b',
  '#334155', '#1e293b', '#0f172a', '#000000', 'transparent',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
];

// Gradient presets
const GRADIENT_PRESETS = [
  { name: 'Indigo', value: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' },
  { name: 'Sunset', value: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)' },
  { name: 'Ocean', value: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' },
  { name: 'Forest', value: 'linear-gradient(135deg, #22c55e 0%, #14b8a6 100%)' },
  { name: 'Night', value: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
  { name: 'Purple', value: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)' },
];

// Font size options
const FONT_SIZES = [
  { label: 'XS', value: '12px' },
  { label: 'SM', value: '14px' },
  { label: 'Base', value: '16px' },
  { label: 'LG', value: '18px' },
  { label: 'XL', value: '20px' },
  { label: '2XL', value: '24px' },
  { label: '3XL', value: '30px' },
  { label: '4XL', value: '36px' },
  { label: '5XL', value: '48px' },
];

// Font weight options
const FONT_WEIGHTS = [
  { label: 'Light', value: '300' },
  { label: 'Normal', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semibold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Black', value: '900' },
];

// Animation presets
const ANIMATION_PRESETS = [
  { label: 'None', value: 'none' },
  { label: 'Fade In', value: 'fadeIn' },
  { label: 'Slide Up', value: 'slideUp' },
  { label: 'Slide Down', value: 'slideDown' },
  { label: 'Scale', value: 'scale' },
  { label: 'Bounce', value: 'bounce' },
];

// Hover effect presets
const HOVER_EFFECTS = [
  { label: 'None', value: 'none' },
  { label: 'Lift', value: 'lift' },
  { label: 'Glow', value: 'glow' },
  { label: 'Scale', value: 'scale' },
  { label: 'Brighten', value: 'brighten' },
];

// Personality options
const PERSONALITY_OPTIONS: { value: LayoutPersonality; label: string; description: string }[] = [
  { value: 'clean', label: 'Clean', description: 'Minimal, breathable' },
  { value: 'bold', label: 'Bold', description: 'High impact, confident' },
  { value: 'editorial', label: 'Editorial', description: 'Magazine-like hierarchy' },
  { value: 'dense', label: 'Dense', description: 'Information-rich, compact' },
  { value: 'conversion', label: 'Conversion', description: 'CTA-focused, urgent' },
];

// ============================================================================
// REUSABLE CONTROLS
// ============================================================================

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  showGradients?: boolean;
}

function ColorPicker({ value, onChange, label, showGradients }: ColorPickerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'solid' | 'gradient'>('solid');
  const isGradient = value?.includes('gradient');
  
  return (
    <div className="ei-field">
      <label className="ei-field-label">{label}</label>
      <button 
        type="button" 
        className="ei-color-trigger"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span 
          className="ei-color-swatch" 
          style={{ background: value || '#ffffff' }}
        />
        <span className="ei-color-value">
          {isGradient ? 'Gradient' : value || 'None'}
        </span>
        <ChevronDown className={cn("ei-chevron", isExpanded && "ei-chevron--open")} size={14} />
      </button>
      
      {isExpanded && (
        <div className="ei-color-popover">
          {showGradients && (
            <div className="ei-color-tabs">
              <button
                type="button"
                className={cn("ei-color-tab", activeTab === 'solid' && "ei-color-tab--active")}
                onClick={() => setActiveTab('solid')}
              >
                Solid
              </button>
              <button
                type="button"
                className={cn("ei-color-tab", activeTab === 'gradient' && "ei-color-tab--active")}
                onClick={() => setActiveTab('gradient')}
              >
                Gradient
              </button>
            </div>
          )}
          
          {activeTab === 'solid' && (
            <>
              <div className="ei-color-grid">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn("ei-color-preset", value === color && "ei-color-preset--active")}
                    style={{ background: color === 'transparent' ? 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50% / 8px 8px' : color }}
                    onClick={() => onChange(color)}
                    title={color}
                  />
                ))}
              </div>
              <div className="ei-color-input-row">
                <input
                  type="color"
                  value={value?.startsWith('#') ? value : '#ffffff'}
                  onChange={(e) => onChange(e.target.value)}
                  className="ei-color-native"
                />
                <input
                  type="text"
                  value={value || ''}
                  onChange={(e) => onChange(e.target.value)}
                  className="ei-text-input ei-text-input--small"
                  placeholder="#000000"
                />
              </div>
            </>
          )}
          
          {activeTab === 'gradient' && showGradients && (
            <div className="ei-gradient-grid">
              {GRADIENT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className={cn("ei-gradient-preset", value === preset.value && "ei-gradient-preset--active")}
                  style={{ background: preset.value }}
                  onClick={() => onChange(preset.value)}
                  title={preset.name}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TextFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

function TextField({ value, onChange, label, placeholder, multiline }: TextFieldProps) {
  return (
    <div className="ei-field">
      <label className="ei-field-label">{label}</label>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="ei-textarea"
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="ei-text-input"
        />
      )}
    </div>
  );
}

interface SliderFieldProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  unit?: string;
}

function SliderField({ value, onChange, label, min = 0, max = 100, unit = '' }: SliderFieldProps) {
  return (
    <div className="ei-field">
      <div className="ei-field-header">
        <label className="ei-field-label">{label}</label>
        <span className="ei-field-value">{value}{unit}</span>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        className="ei-slider"
      />
    </div>
  );
}

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: { value: string; label: string }[];
}

function SelectField({ value, onChange, label, options }: SelectFieldProps) {
  return (
    <div className="ei-field">
      <label className="ei-field-label">{label}</label>
      <select
        value={value || options[0]?.value}
        onChange={(e) => onChange(e.target.value)}
        className="ei-select"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

interface ButtonGroupProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: { value: string; label?: string | React.ReactNode; icon?: React.ReactNode }[];
}

function ButtonGroup({ value, onChange, label, options }: ButtonGroupProps) {
  return (
    <div className="ei-field">
      <label className="ei-field-label">{label}</label>
      <div className="ei-button-group">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={cn("ei-button-group-item", value === opt.value && "ei-button-group-item--active")}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon || opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SwitchField({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="ei-field ei-field--row">
      <label className="ei-field-label">{label}</label>
      <button
        type="button"
        className={cn("ei-switch", value && "ei-switch--on")}
        onClick={() => onChange(!value)}
      >
        <span className="ei-switch-thumb" />
      </button>
    </div>
  );
}

// ============================================================================
// SECTIONS
// ============================================================================

function InspectorSection({ 
  title, 
  icon,
  children, 
  defaultOpen = true 
}: { 
  title: string; 
  icon?: React.ReactNode;
  children: React.ReactNode; 
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="ei-section">
      <button
        type="button"
        className="ei-section-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="ei-section-title">
          {icon}
          <span>{title}</span>
        </div>
        <ChevronDown className={cn("ei-chevron", isOpen && "ei-chevron--open")} size={14} />
      </button>
      {isOpen && <div className="ei-section-content">{children}</div>}
    </div>
  );
}

// Multi-choice options editor
function OptionsEditor({ 
  options, 
  onChange 
}: { 
  options: Array<{ id: string; label: string; emoji?: string }>; 
  onChange: (options: Array<{ id: string; label: string; emoji?: string }>) => void;
}) {
  const handleOptionChange = (index: number, field: 'label' | 'emoji', value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    onChange(newOptions);
  };

  const addOption = () => {
    onChange([...options, { id: `opt${Date.now()}`, label: 'New Option', emoji: '✨' }]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      onChange(options.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="ei-options-editor">
      {options.map((option, index) => (
        <div key={option.id} className="ei-option-row">
          <GripVertical size={14} className="ei-option-grip" />
          <input
            type="text"
            value={option.emoji || ''}
            onChange={(e) => handleOptionChange(index, 'emoji', e.target.value)}
            className="ei-option-emoji"
            placeholder="✨"
          />
          <input
            type="text"
            value={option.label}
            onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
            className="ei-option-label"
            placeholder="Option label"
          />
          <button
            type="button"
            className="ei-option-delete"
            onClick={() => removeOption(index)}
            disabled={options.length <= 2}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="ei-add-option" onClick={addOption}>
        <Plus size={14} /> Add Option
      </button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EnhancedInspector() {
  const {
    pages,
    activePageId,
    selectedNodeId,
    updateNodeProps,
    updatePageProps,
  } = useEditorStore();

  const [activeTab, setActiveTab] = useState<InspectorTab>('content');

  const page = pages.find((p) => p.id === activePageId) ?? null;

  // Handle page personality update
  const handleUpdatePersonality = useCallback((personality: LayoutPersonality) => {
    if (page) {
      updatePageProps(page.id, { layoutPersonality: personality });
    }
  }, [page, updatePageProps]);

  // No page selected
  if (!page) {
    return (
      <div className="ei-inspector ei-inspector--empty">
        <div className="ei-empty-state">
          <Layout size={24} />
          <p>No page selected</p>
        </div>
      </div>
    );
  }

  const selectedNode = selectedNodeId 
    ? findNodeById(page.canvasRoot, selectedNodeId) 
    : null;
  
  const definition = selectedNode 
    ? (ComponentRegistry[selectedNode.type] ?? fallbackComponent)
    : null;

  // Page-level inspector when no node selected
  if (!selectedNode || !definition) {
    return (
      <div className="ei-inspector">
        <header className="ei-header">
          <h3 className="ei-title">Page Settings</h3>
          <span className="ei-subtitle">{page.name}</span>
        </header>

        <div className="ei-body">
          <InspectorSection title="Page Info" icon={<Type size={14} />}>
            <TextField
              value={page.name}
              onChange={(name) => updatePageProps(page.id, { name })}
              label="Page Name"
            />
          </InspectorSection>

          <InspectorSection title="Layout Personality" icon={<Layout size={14} />}>
            <div className="ei-personality-grid">
              {PERSONALITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={cn(
                    "ei-personality-option",
                    page.layoutPersonality === p.value && "ei-personality-option--active"
                  )}
                  onClick={() => handleUpdatePersonality(p.value)}
                >
                  <span className="ei-personality-label">{p.label}</span>
                  <span className="ei-personality-desc">{p.description}</span>
                </button>
              ))}
            </div>
          </InspectorSection>
        </div>
      </div>
    );
  }

  // Node-level inspector
  const nodeType = selectedNode.type;
  const nodeProps = selectedNode.props as Record<string, any>;
  const defaultProps = definition.defaultProps || {};

  const handlePropChange = (key: string, value: any) => {
    updateNodeProps(selectedNode.id, { [key]: value });
  };

  const handleResetToDefaults = () => {
    Object.keys(defaultProps).forEach((key) => {
      handlePropChange(key, defaultProps[key]);
    });
  };

  return (
    <div className="ei-inspector">
      <header className="ei-header">
        <div className="ei-header-row">
          <h3 className="ei-title">{definition.displayName}</h3>
          <button
            type="button"
            className="ei-reset-btn"
            onClick={handleResetToDefaults}
            title="Reset to defaults"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </header>

      <div className="ei-tabs">
        <button
          type="button"
          className={cn("ei-tab", activeTab === 'content' && "ei-tab--active")}
          onClick={() => setActiveTab('content')}
        >
          <Type size={14} /> Content
        </button>
        <button
          type="button"
          className={cn("ei-tab", activeTab === 'style' && "ei-tab--active")}
          onClick={() => setActiveTab('style')}
        >
          <Palette size={14} /> Style
        </button>
        <button
          type="button"
          className={cn("ei-tab", activeTab === 'layout' && "ei-tab--active")}
          onClick={() => setActiveTab('layout')}
        >
          <Layout size={14} /> Layout
        </button>
      </div>

      <div className="ei-body">
        {/* ====== CONTENT TAB ====== */}
        {activeTab === 'content' && (
          <>
            {/* Text Content */}
            {(nodeProps.text !== undefined || nodeProps.headline !== undefined) && (
              <InspectorSection title="Text" icon={<Type size={14} />}>
                {nodeProps.text !== undefined && (
                  <TextField
                    value={nodeProps.text}
                    onChange={(v) => handlePropChange('text', v)}
                    label="Text"
                    multiline={nodeType === 'paragraph'}
                  />
                )}
                {nodeProps.headline !== undefined && (
                  <TextField
                    value={nodeProps.headline}
                    onChange={(v) => handlePropChange('headline', v)}
                    label="Headline"
                  />
                )}
                {nodeProps.subtext !== undefined && (
                  <TextField
                    value={nodeProps.subtext}
                    onChange={(v) => handlePropChange('subtext', v)}
                    label="Subtext"
                    multiline
                  />
                )}
              </InspectorSection>
            )}

            {/* Button */}
            {nodeProps.buttonText !== undefined && (
              <InspectorSection title="Button" icon={<Type size={14} />}>
                <TextField
                  value={nodeProps.buttonText}
                  onChange={(v) => handlePropChange('buttonText', v)}
                  label="Button Label"
                />
                <TextField
                  value={nodeProps.buttonUrl || ''}
                  onChange={(v) => handlePropChange('buttonUrl', v)}
                  label="Link URL"
                  placeholder="https://..."
                />
              </InspectorSection>
            )}

            {/* Input Fields */}
            {nodeProps.placeholder !== undefined && (
              <InspectorSection title="Input" icon={<Type size={14} />}>
                <TextField
                  value={nodeProps.placeholder}
                  onChange={(v) => handlePropChange('placeholder', v)}
                  label="Placeholder"
                />
                <TextField
                  value={nodeProps.label || ''}
                  onChange={(v) => handlePropChange('label', v)}
                  label="Label"
                />
              </InspectorSection>
            )}

            {/* Video/Embed */}
            {nodeProps.videoUrl !== undefined && (
              <InspectorSection title="Video" icon={<Type size={14} />}>
                <TextField
                  value={nodeProps.videoUrl}
                  onChange={(v) => handlePropChange('videoUrl', v)}
                  label="Video URL"
                  placeholder="https://youtube.com/watch?v=..."
                />
                <SwitchField
                  value={nodeProps.autoplay || false}
                  onChange={(v) => handlePropChange('autoplay', v)}
                  label="Autoplay"
                />
              </InspectorSection>
            )}

            {nodeProps.embedUrl !== undefined && (
              <InspectorSection title="Embed" icon={<Type size={14} />}>
                <TextField
                  value={nodeProps.embedUrl}
                  onChange={(v) => handlePropChange('embedUrl', v)}
                  label="Embed URL"
                  placeholder="https://calendly.com/..."
                />
              </InspectorSection>
            )}

            {/* Image */}
            {nodeProps.src !== undefined && (
              <InspectorSection title="Image" icon={<Type size={14} />}>
                <TextField
                  value={nodeProps.src}
                  onChange={(v) => handlePropChange('src', v)}
                  label="Image URL"
                  placeholder="https://..."
                />
                <TextField
                  value={nodeProps.alt || ''}
                  onChange={(v) => handlePropChange('alt', v)}
                  label="Alt Text"
                />
              </InspectorSection>
            )}

            {/* Options (Multi-choice) */}
            {nodeProps.options && Array.isArray(nodeProps.options) && (
              <InspectorSection title="Options" icon={<Type size={14} />}>
                <OptionsEditor
                  options={nodeProps.options}
                  onChange={(opts) => handlePropChange('options', opts)}
                />
              </InspectorSection>
            )}
          </>
        )}

        {/* ====== STYLE TAB ====== */}
        {activeTab === 'style' && (
          <>
            {/* Typography */}
            <InspectorSection title="Typography" icon={<Type size={14} />}>
              <ButtonGroup
                value={nodeProps.textAlign || 'center'}
                onChange={(v) => handlePropChange('textAlign', v)}
                label="Alignment"
                options={[
                  { value: 'left', icon: <AlignLeft size={14} /> },
                  { value: 'center', icon: <AlignCenter size={14} /> },
                  { value: 'right', icon: <AlignRight size={14} /> },
                ]}
              />
              <SelectField
                value={nodeProps.fontSize || '16px'}
                onChange={(v) => handlePropChange('fontSize', v)}
                label="Font Size"
                options={FONT_SIZES}
              />
              <SelectField
                value={nodeProps.fontWeight || '400'}
                onChange={(v) => handlePropChange('fontWeight', v)}
                label="Font Weight"
                options={FONT_WEIGHTS}
              />
            </InspectorSection>

            {/* Colors */}
            <InspectorSection title="Colors" icon={<Palette size={14} />}>
              <ColorPicker
                value={nodeProps.color || '#ffffff'}
                onChange={(v) => handlePropChange('color', v)}
                label="Text Color"
              />
              <ColorPicker
                value={nodeProps.backgroundColor || 'transparent'}
                onChange={(v) => handlePropChange('backgroundColor', v)}
                label="Background"
                showGradients
              />
            </InspectorSection>

            {/* Button Styling */}
            {(nodeType === 'button' || nodeProps.buttonText !== undefined) && (
              <InspectorSection title="Button Style" icon={<Palette size={14} />}>
                <ColorPicker
                  value={nodeProps.buttonColor || '#6366f1'}
                  onChange={(v) => handlePropChange('buttonColor', v)}
                  label="Button Background"
                  showGradients
                />
                <ColorPicker
                  value={nodeProps.buttonTextColor || '#ffffff'}
                  onChange={(v) => handlePropChange('buttonTextColor', v)}
                  label="Button Text"
                />
                <SliderField
                  value={nodeProps.buttonRadius || 12}
                  onChange={(v) => handlePropChange('buttonRadius', v)}
                  label="Corner Radius"
                  min={0}
                  max={32}
                  unit="px"
                />
              </InspectorSection>
            )}

            {/* Borders & Shadows */}
            <InspectorSection title="Effects" icon={<Sparkles size={14} />} defaultOpen={false}>
              <SliderField
                value={nodeProps.borderRadius || 0}
                onChange={(v) => handlePropChange('borderRadius', v)}
                label="Corner Radius"
                min={0}
                max={48}
                unit="px"
              />
              <SelectField
                value={nodeProps.shadow || 'none'}
                onChange={(v) => handlePropChange('shadow', v)}
                label="Shadow"
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'sm', label: 'Small' },
                  { value: 'md', label: 'Medium' },
                  { value: 'lg', label: 'Large' },
                  { value: 'xl', label: 'Extra Large' },
                ]}
              />
              <ColorPicker
                value={nodeProps.borderColor || 'transparent'}
                onChange={(v) => handlePropChange('borderColor', v)}
                label="Border Color"
              />
              <SliderField
                value={nodeProps.borderWidth || 0}
                onChange={(v) => handlePropChange('borderWidth', v)}
                label="Border Width"
                min={0}
                max={8}
                unit="px"
              />
            </InspectorSection>

            {/* Animation & Hover */}
            <InspectorSection title="Animation" icon={<Sparkles size={14} />} defaultOpen={false}>
              <SelectField
                value={nodeProps.animation || 'none'}
                onChange={(v) => handlePropChange('animation', v)}
                label="Enter Animation"
                options={ANIMATION_PRESETS}
              />
              <SelectField
                value={nodeProps.hoverEffect || 'none'}
                onChange={(v) => handlePropChange('hoverEffect', v)}
                label="Hover Effect"
                options={HOVER_EFFECTS}
              />
            </InspectorSection>
          </>
        )}

        {/* ====== LAYOUT TAB ====== */}
        {activeTab === 'layout' && (
          <>
            <InspectorSection title="Spacing" icon={<Layout size={14} />}>
              <SliderField
                value={nodeProps.paddingTop || 0}
                onChange={(v) => handlePropChange('paddingTop', v)}
                label="Padding Top"
                min={0}
                max={64}
                unit="px"
              />
              <SliderField
                value={nodeProps.paddingBottom || 0}
                onChange={(v) => handlePropChange('paddingBottom', v)}
                label="Padding Bottom"
                min={0}
                max={64}
                unit="px"
              />
              <SliderField
                value={nodeProps.paddingX || 0}
                onChange={(v) => handlePropChange('paddingX', v)}
                label="Padding Sides"
                min={0}
                max={64}
                unit="px"
              />
              <SliderField
                value={nodeProps.gap || 0}
                onChange={(v) => handlePropChange('gap', v)}
                label="Gap"
                min={0}
                max={48}
                unit="px"
              />
            </InspectorSection>

            <InspectorSection title="Size" icon={<Layout size={14} />}>
              <SelectField
                value={nodeProps.maxWidth || 'full'}
                onChange={(v) => handlePropChange('maxWidth', v)}
                label="Max Width"
                options={[
                  { value: 'full', label: '100%' },
                  { value: 'sm', label: 'Small (320px)' },
                  { value: 'md', label: 'Medium (480px)' },
                  { value: 'lg', label: 'Large (640px)' },
                  { value: 'xl', label: 'Extra Large (800px)' },
                ]}
              />
              {nodeType === 'spacer' && (
                <SliderField
                  value={nodeProps.height || 32}
                  onChange={(v) => handlePropChange('height', v)}
                  label="Height"
                  min={8}
                  max={120}
                  unit="px"
                />
              )}
            </InspectorSection>

            <InspectorSection title="Element Info" icon={<Settings size={14} />} defaultOpen={false}>
              <div className="ei-info-row">
                <span className="ei-info-label">Type</span>
                <span className="ei-info-value">{definition.displayName}</span>
              </div>
              <div className="ei-info-row">
                <span className="ei-info-label">ID</span>
                <span className="ei-info-value ei-info-value--mono">{selectedNode.id.slice(0, 8)}...</span>
              </div>
            </InspectorSection>
          </>
        )}
      </div>
    </div>
  );
}
