import { useState, useCallback } from 'react';
import { 
  Type, 
  Palette, 
  Layout, 
  Image, 
  Video, 
  Link,
  Plus,
  Trash2,
  GripVertical,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '../state/editorStore';
import { ComponentRegistry, fallbackComponent } from '../registry/componentRegistry';
import type { CanvasNode, LayoutPersonality } from '../types';

type InspectorTab = 'content' | 'style' | 'settings';

// Find node by ID in tree
function findNodeById(node: CanvasNode, nodeId: string): CanvasNode | null {
  if (node.id === nodeId) return node;
  for (const child of node.children) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

// Color presets for quick selection
const COLOR_PRESETS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
  '#ffffff', '#000000', '#111827', '#374151', '#6b7280',
];

// Button style presets
const BUTTON_PRESETS = [
  { name: 'Primary', bg: '#6366f1', text: '#ffffff', radius: 12 },
  { name: 'Secondary', bg: '#374151', text: '#ffffff', radius: 8 },
  { name: 'Success', bg: '#22c55e', text: '#ffffff', radius: 12 },
  { name: 'Gradient', bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)', text: '#ffffff', radius: 16 },
  { name: 'Outline', bg: 'transparent', text: '#ffffff', radius: 12, border: '2px solid #6366f1' },
];

// Personality options
const PERSONALITY_OPTIONS: { value: LayoutPersonality; label: string; description: string }[] = [
  { value: 'clean', label: 'Clean', description: 'Minimal, breathable' },
  { value: 'bold', label: 'Bold', description: 'High impact, confident' },
  { value: 'editorial', label: 'Editorial', description: 'Magazine-like hierarchy' },
  { value: 'dense', label: 'Dense', description: 'Information-rich, compact' },
  { value: 'conversion', label: 'Conversion', description: 'CTA-focused, urgent' },
];

interface ColorPickerInlineProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

function ColorPickerInline({ value, onChange, label }: ColorPickerInlineProps) {
  const [showPicker, setShowPicker] = useState(false);
  
  return (
    <div className="inspector-field">
      <label className="inspector-field-label">{label}</label>
      <div className="inspector-color-row">
        <button
          type="button"
          className="inspector-color-swatch"
          style={{ backgroundColor: value }}
          onClick={() => setShowPicker(!showPicker)}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="inspector-color-input"
        />
      </div>
      {showPicker && (
        <div className="inspector-color-presets">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "inspector-color-preset",
                value === color && "inspector-color-preset--active"
              )}
              style={{ backgroundColor: color }}
              onClick={() => {
                onChange(color);
                setShowPicker(false);
              }}
            />
          ))}
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
    <div className="inspector-field">
      <label className="inspector-field-label">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="inspector-textarea"
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="inspector-input"
        />
      )}
    </div>
  );
}

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  unit?: string;
}

function NumberField({ value, onChange, label, min, max, unit }: NumberFieldProps) {
  return (
    <div className="inspector-field">
      <label className="inspector-field-label">{label}</label>
      <div className="inspector-number-row">
        <input
          type="range"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          className="inspector-slider"
        />
        <span className="inspector-number-value">{value}{unit}</span>
      </div>
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
    <div className="inspector-field">
      <label className="inspector-field-label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="inspector-select"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function InspectorSection({ 
  title, 
  children, 
  defaultOpen = true 
}: { 
  title: string; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="inspector-section">
      <button
        type="button"
        className="inspector-section-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <span className={cn("inspector-section-chevron", isOpen && "inspector-section-chevron--open")}>
          ›
        </span>
      </button>
      {isOpen && <div className="inspector-section-content">{children}</div>}
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
    onChange([...options, { id: `opt${options.length + 1}`, label: 'New Option', emoji: '✨' }]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      onChange(options.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="inspector-options-editor">
      {options.map((option, index) => (
        <div key={option.id} className="inspector-option-row">
          <GripVertical size={14} className="inspector-option-grip" />
          <input
            type="text"
            value={option.emoji || ''}
            onChange={(e) => handleOptionChange(index, 'emoji', e.target.value)}
            className="inspector-option-emoji"
            placeholder="✨"
          />
          <input
            type="text"
            value={option.label}
            onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
            className="inspector-option-label"
            placeholder="Option label"
          />
          <button
            type="button"
            className="inspector-option-delete"
            onClick={() => removeOption(index)}
            disabled={options.length <= 2}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="inspector-add-option" onClick={addOption}>
        <Plus size={14} /> Add Option
      </button>
    </div>
  );
}

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
      <div className="enhanced-inspector enhanced-inspector--empty">
        <div className="inspector-empty-state">
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
      <div className="enhanced-inspector">
        <header className="inspector-header">
          <h3 className="inspector-title">Page Settings</h3>
          <span className="inspector-subtitle">{page.name}</span>
        </header>

        <div className="inspector-tabs">
          <button
            type="button"
            className={cn("inspector-tab", activeTab === 'content' && "inspector-tab--active")}
            onClick={() => setActiveTab('content')}
          >
            <Type size={14} /> Content
          </button>
          <button
            type="button"
            className={cn("inspector-tab", activeTab === 'style' && "inspector-tab--active")}
            onClick={() => setActiveTab('style')}
          >
            <Palette size={14} /> Style
          </button>
          <button
            type="button"
            className={cn("inspector-tab", activeTab === 'settings' && "inspector-tab--active")}
            onClick={() => setActiveTab('settings')}
          >
            <Layout size={14} /> Settings
          </button>
        </div>

        <div className="inspector-body">
          {activeTab === 'content' && (
            <InspectorSection title="Page Info">
              <TextField
                value={page.name}
                onChange={(name) => updatePageProps(page.id, { name })}
                label="Page Name"
              />
            </InspectorSection>
          )}

          {activeTab === 'style' && (
            <InspectorSection title="Layout Personality">
              <div className="inspector-personality-grid">
                {PERSONALITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={cn(
                      "inspector-personality-option",
                      page.layoutPersonality === p.value && "inspector-personality-option--active"
                    )}
                    onClick={() => handleUpdatePersonality(p.value)}
                  >
                    <span className="inspector-personality-label">{p.label}</span>
                    <span className="inspector-personality-desc">{p.description}</span>
                  </button>
                ))}
              </div>
            </InspectorSection>
          )}

          {activeTab === 'settings' && (
            <InspectorSection title="Advanced">
              <p className="inspector-help-text">
                Click on elements in the canvas to edit their properties.
              </p>
            </InspectorSection>
          )}
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

  const handleResetProp = (key: string) => {
    updateNodeProps(selectedNode.id, { [key]: defaultProps[key] });
  };

  // Get design props
  const design = nodeProps.design || {};
  const handleDesignChange = (key: string, value: any) => {
    updateNodeProps(selectedNode.id, { 
      design: { ...design, [key]: value } 
    });
  };

  return (
    <div className="enhanced-inspector">
      <header className="inspector-header">
        <h3 className="inspector-title">{definition.displayName}</h3>
        <span className="inspector-subtitle">Step Element</span>
      </header>

      <div className="inspector-tabs">
        <button
          type="button"
          className={cn("inspector-tab", activeTab === 'content' && "inspector-tab--active")}
          onClick={() => setActiveTab('content')}
        >
          <Type size={14} /> Content
        </button>
        <button
          type="button"
          className={cn("inspector-tab", activeTab === 'style' && "inspector-tab--active")}
          onClick={() => setActiveTab('style')}
        >
          <Palette size={14} /> Style
        </button>
        <button
          type="button"
          className={cn("inspector-tab", activeTab === 'settings' && "inspector-tab--active")}
          onClick={() => setActiveTab('settings')}
        >
          <Layout size={14} /> Layout
        </button>
      </div>

      <div className="inspector-body">
        {/* Content Tab */}
        {activeTab === 'content' && (
          <>
            {/* Headline */}
            {nodeProps.headline !== undefined && (
              <InspectorSection title="Headline">
                <TextField
                  value={nodeProps.headline}
                  onChange={(v) => handlePropChange('headline', v)}
                  label="Text"
                />
              </InspectorSection>
            )}

            {/* Subtext */}
            {nodeProps.subtext !== undefined && (
              <InspectorSection title="Subtext">
                <TextField
                  value={nodeProps.subtext}
                  onChange={(v) => handlePropChange('subtext', v)}
                  label="Text"
                  multiline
                />
              </InspectorSection>
            )}

            {/* Button Text */}
            {nodeProps.buttonText !== undefined && (
              <InspectorSection title="Button">
                <TextField
                  value={nodeProps.buttonText}
                  onChange={(v) => handlePropChange('buttonText', v)}
                  label="Button Label"
                />
              </InspectorSection>
            )}

            {/* Placeholder */}
            {nodeProps.placeholder !== undefined && (
              <InspectorSection title="Input">
                <TextField
                  value={nodeProps.placeholder}
                  onChange={(v) => handlePropChange('placeholder', v)}
                  label="Placeholder Text"
                />
              </InspectorSection>
            )}

            {/* Video URL */}
            {nodeProps.videoUrl !== undefined && (
              <InspectorSection title="Video">
                <TextField
                  value={nodeProps.videoUrl}
                  onChange={(v) => handlePropChange('videoUrl', v)}
                  label="Video URL"
                  placeholder="https://youtube.com/watch?v=..."
                />
                <p className="inspector-help-text">
                  Supports YouTube, Vimeo, and Loom URLs
                </p>
              </InspectorSection>
            )}

            {/* Embed URL */}
            {nodeProps.embedUrl !== undefined && (
              <InspectorSection title="Embed">
                <TextField
                  value={nodeProps.embedUrl}
                  onChange={(v) => handlePropChange('embedUrl', v)}
                  label="Embed URL"
                  placeholder="https://calendly.com/..."
                />
                <p className="inspector-help-text">
                  Calendly, Cal.com, or custom iframe URL
                </p>
              </InspectorSection>
            )}

            {/* Multi-choice Options */}
            {nodeProps.options && Array.isArray(nodeProps.options) && (
              <InspectorSection title="Options">
                <OptionsEditor
                  options={nodeProps.options}
                  onChange={(opts) => handlePropChange('options', opts)}
                />
              </InspectorSection>
            )}
          </>
        )}

        {/* Style Tab */}
        {activeTab === 'style' && (
          <>
            <InspectorSection title="Colors">
              <ColorPickerInline
                value={design.textColor || '#ffffff'}
                onChange={(v) => handleDesignChange('textColor', v)}
                label="Text Color"
              />
              <ColorPickerInline
                value={design.backgroundColor || '#0f0f0f'}
                onChange={(v) => handleDesignChange('backgroundColor', v)}
                label="Background"
              />
            </InspectorSection>

            <InspectorSection title="Button Style">
              <ColorPickerInline
                value={design.buttonColor || '#6366f1'}
                onChange={(v) => handleDesignChange('buttonColor', v)}
                label="Button Background"
              />
              <ColorPickerInline
                value={design.buttonTextColor || '#ffffff'}
                onChange={(v) => handleDesignChange('buttonTextColor', v)}
                label="Button Text"
              />
              <NumberField
                value={design.borderRadius || 12}
                onChange={(v) => handleDesignChange('borderRadius', v)}
                label="Border Radius"
                min={0}
                max={32}
                unit="px"
              />
            </InspectorSection>

            <InspectorSection title="Typography">
              <SelectField
                value={design.fontSize || 'medium'}
                onChange={(v) => handleDesignChange('fontSize', v)}
                label="Size"
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'large', label: 'Large' },
                ]}
              />
            </InspectorSection>

            <InspectorSection title="Presets" defaultOpen={false}>
              <div className="inspector-button-presets">
                {BUTTON_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className="inspector-button-preset"
                    onClick={() => {
                      handleDesignChange('buttonColor', preset.bg);
                      handleDesignChange('buttonTextColor', preset.text);
                      handleDesignChange('borderRadius', preset.radius);
                    }}
                  >
                    <span
                      className="inspector-preset-swatch"
                      style={{ 
                        background: preset.bg, 
                        color: preset.text,
                        border: preset.border,
                      }}
                    >
                      Aa
                    </span>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </InspectorSection>
          </>
        )}

        {/* Settings/Layout Tab */}
        {activeTab === 'settings' && (
          <>
            <InspectorSection title="Element Info">
              <div className="inspector-info-row">
                <span className="inspector-info-label">Type</span>
                <span className="inspector-info-value">{definition.displayName}</span>
              </div>
              <div className="inspector-info-row">
                <span className="inspector-info-label">ID</span>
                <span className="inspector-info-value inspector-info-value--mono">{selectedNode.id}</span>
              </div>
            </InspectorSection>

            <InspectorSection title="Quick Actions">
              <button
                type="button"
                className="inspector-action-button"
                onClick={() => {
                  // Reset to defaults
                  Object.keys(defaultProps).forEach((key) => {
                    handleResetProp(key);
                  });
                }}
              >
                <RotateCcw size={14} />
                Reset to Default
              </button>
            </InspectorSection>
          </>
        )}
      </div>
    </div>
  );
}
