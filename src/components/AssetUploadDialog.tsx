import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface AssetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  defaultCategory?: string;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: 'training', label: 'Training' },
  { value: 'team_onboarding', label: 'Team Onboarding' },
  { value: 'client_onboarding', label: 'Client Onboarding' },
  { value: 'tracking', label: 'Tracking Sheets' },
  { value: 'resources', label: 'Resources & Scripts' },
];

export default function AssetUploadDialog({
  open,
  onOpenChange,
  teamId,
  defaultCategory,
  onSuccess,
}: AssetUploadDialogProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(defaultCategory || '');
  const [assetType, setAssetType] = useState<'file' | 'loom' | 'link'>('loom');
  const [file, setFile] = useState<File | null>(null);
  const [loomUrl, setLoomUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Update category when defaultCategory changes
  useEffect(() => {
    if (defaultCategory && open) {
      setCategory(defaultCategory);
    }
  }, [defaultCategory, open]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory(defaultCategory || '');
    setAssetType('loom');
    setFile(null);
    setLoomUrl('');
    setExternalUrl('');
    setUploadProgress(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !category) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      let filePath: string | null = null;
      let fileType: string | null = null;

      if (assetType === 'file' && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${teamId}/${Date.now()}-${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('team-assets')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        filePath = fileName;
        fileType = file.type;
        setUploadProgress(50);
      }

      const { error: insertError } = await supabase.from('team_assets').insert({
        team_id: teamId,
        title,
        description: description || null,
        category,
        file_path: filePath,
        file_type: fileType,
        loom_url: assetType === 'loom' ? loomUrl : null,
        external_url: assetType === 'link' ? externalUrl : null,
        created_by: user.id,
      });

      if (insertError) throw insertError;

      setUploadProgress(100);
      toast.success('Asset added successfully');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding asset:', error);
      toast.error('Failed to add asset');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Asset</DialogTitle>
          <DialogDescription>
            Add training videos, documents, or external resources
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sales Training Module 1"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Asset Type *</Label>
            <RadioGroup value={assetType} onValueChange={(v: any) => setAssetType(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="loom" id="loom" />
                <Label htmlFor="loom" className="font-normal">
                  Video (Loom, YouTube, Vimeo, etc.)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="link" id="link" />
                <Label htmlFor="link" className="font-normal">
                  External Link
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="file" id="file" />
                <Label htmlFor="file" className="font-normal">
                  File Upload (PDF, etc.)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {assetType === 'file' && (
            <div className="space-y-2">
              <Label htmlFor="file-upload">File *</Label>
              <Input
                id="file-upload"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".mp4,.mov,.pdf,.png,.jpg,.jpeg,.webp,.txt,.md"
                required
              />
              <p className="text-xs text-muted-foreground">
                Max 50MB. Supported: MP4, MOV, PDF, PNG, JPG, WEBP, TXT, MD
              </p>
            </div>
          )}

          {assetType === 'loom' && (
            <div className="space-y-2">
              <Label htmlFor="loom-url">Video URL *</Label>
              <Input
                id="loom-url"
                value={loomUrl}
                onChange={(e) => setLoomUrl(e.target.value)}
                placeholder="https://www.loom.com/share/... or YouTube/Vimeo URL"
                required
              />
              <p className="text-xs text-muted-foreground">
                Supports Loom, YouTube, Vimeo, and Wistia URLs
              </p>
            </div>
          )}

          {assetType === 'link' && (
            <div className="space-y-2">
              <Label htmlFor="external-url">External URL *</Label>
              <Input
                id="external-url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://..."
                required
              />
            </div>
          )}

          {uploading && uploadProgress > 0 && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-xs text-center text-muted-foreground">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploading || !title || !category}>
              {uploading ? 'Adding...' : 'Add Asset'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
