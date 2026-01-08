/**
 * EditorHeader - Perspective-style top navigation bar
 * Clean with funnel name, device switcher, and action buttons
 */

import { 
  ArrowLeft, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Eye, 
  Undo2, 
  Redo2, 
  Settings, 
  ExternalLink, 
  Save, 
  Globe,
  BarChart3,
  Users,
  AppWindow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DeviceType = 'phone' | 'tablet' | 'desktop';
type EditorTab = 'funnel' | 'metrics' | 'contacts' | 'apps';

interface EditorHeaderProps {
  funnelName: string;
  device: DeviceType;
  mode: 'edit' | 'preview';
  activeTab: EditorTab;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  previewUrl: string;
  onBack: () => void;
  onDeviceChange: (device: DeviceType) => void;
  onModeChange: (mode: 'edit' | 'preview') => void;
  onTabChange: (tab: EditorTab) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSettings: () => void;
  onPreview: () => void;
  onSave: () => void;
  onPublish: () => void;
}

export function EditorHeader({
  funnelName,
  device,
  mode,
  activeTab,
  canUndo,
  canRedo,
  isSaving,
  isPublishing,
  previewUrl,
  onBack,
  onDeviceChange,
  onModeChange,
  onTabChange,
  onUndo,
  onRedo,
  onSettings,
  onPreview,
  onSave,
  onPublish,
}: EditorHeaderProps) {
  const tabs: { id: EditorTab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'funnel', label: 'Funnel', icon: AppWindow },
    { id: 'metrics', label: 'Metrics', icon: BarChart3 },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'apps', label: 'Apps', icon: AppWindow },
  ];

  const devices: { type: DeviceType; icon: typeof Smartphone }[] = [
    { type: 'phone', icon: Smartphone },
    { type: 'tablet', icon: Tablet },
    { type: 'desktop', icon: Monitor },
  ];

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
      {/* Left section - Back and name */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack} 
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-semibold text-slate-900">{funnelName}</h1>
      </div>

      {/* Center section - Tabs */}
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-slate-100 text-slate-900"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Right section - Controls */}
      <div className="flex items-center gap-2">
        {/* Device switcher */}
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {devices.map(({ type, icon: Icon }) => (
            <button
              key={type}
              onClick={() => onDeviceChange(type)}
              className={cn(
                "rounded-md p-1.5 transition-all",
                device === type
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* Edit/Preview toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            onClick={() => onModeChange('edit')}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              mode === 'edit'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Edit
          </button>
          <button
            onClick={() => onModeChange('preview')}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              mode === 'preview'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Eye size={12} />
            Preview
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={cn(
              "rounded-md p-1.5",
              canUndo ? "text-slate-600 hover:bg-white" : "text-slate-300"
            )}
            title="Undo"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={cn(
              "rounded-md p-1.5",
              canRedo ? "text-slate-600 hover:bg-white" : "text-slate-300"
            )}
            title="Redo"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Settings and preview buttons */}
        <button
          onClick={onSettings}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <Settings size={16} />
        </button>
        <button
          onClick={onPreview}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <ExternalLink size={16} />
        </button>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* Save and Publish */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="h-8 text-xs"
        >
          <Save size={12} className="mr-1.5" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          size="sm"
          onClick={onPublish}
          disabled={isPublishing}
          className="h-8 text-xs"
        >
          <Globe size={12} className="mr-1.5" />
          {isPublishing ? 'Publishing...' : 'Publish'}
        </Button>
      </div>
    </header>
  );
}
