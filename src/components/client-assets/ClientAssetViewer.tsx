import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, EyeOff, Copy, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ClientAssetViewerProps {
  assetId: string;
  onClose: () => void;
}

interface AssetField {
  id: string;
  field_category: string;
  field_name: string;
  field_value: string;
  field_type: string;
  order_index: number;
}

interface AssetFile {
  id: string;
  file_category: string;
  file_name: string;
  file_path: string;
  file_size: number;
}

export function ClientAssetViewer({ assetId, onClose }: ClientAssetViewerProps) {
  const [asset, setAsset] = useState<any>(null);
  const [fields, setFields] = useState<AssetField[]>([]);
  const [files, setFiles] = useState<AssetFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAssetDetails();
  }, [assetId]);

  const loadAssetDetails = async () => {
    setLoading(true);

    // Load asset
    const { data: assetData, error: assetError } = await supabase
      .from('client_assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (assetError) {
      console.error('Error loading asset:', assetError);
      toast.error('Failed to load asset details');
      return;
    }

    // Load fields
    const { data: fieldsData, error: fieldsError } = await supabase
      .from('client_asset_fields')
      .select('*')
      .eq('client_asset_id', assetId)
      .order('order_index');

    if (fieldsError) {
      console.error('Error loading fields:', fieldsError);
    }

    // Load files
    const { data: filesData, error: filesError } = await supabase
      .from('client_asset_files')
      .select('*')
      .eq('client_asset_id', assetId);

    if (filesError) {
      console.error('Error loading files:', filesError);
    }

    setAsset(assetData);
    setFields(fieldsData || []);
    setFiles(filesData || []);
    setLoading(false);
  };

  const togglePasswordVisibility = (fieldId: string) => {
    setVisiblePasswords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('client-assets')
      .download(filePath);

    if (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File downloaded');
  };

  const handleDelete = async () => {
    try {
      // Delete files from storage
      for (const file of files) {
        await supabase.storage.from('client-assets').remove([file.file_path]);
      }

      // Delete the client asset (cascade will delete fields, files, and audit logs)
      const { error } = await supabase
        .from('client_assets')
        .delete()
        .eq('id', assetId);

      if (error) throw error;

      toast.success('Client asset deleted successfully');
      onClose();
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error('Failed to delete client asset');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading asset details...</p>
      </div>
    );
  }

  if (!asset) return null;

  const groupedFields = fields.reduce((acc, field) => {
    if (!acc[field.field_category]) {
      acc[field.field_category] = [];
    }
    acc[field.field_category].push(field);
    return acc;
  }, {} as Record<string, AssetField[]>);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onClose}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to List
      </Button>

      {/* Header */}
      <Card className="bg-card/50 backdrop-blur-sm border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{asset.client_name}</CardTitle>
              <p className="text-muted-foreground mt-1">{asset.client_email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={asset.status === 'complete' ? 'default' : 'secondary'}>
                {asset.status.replace('_', ' ')}
              </Badge>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Client Asset?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all information for {asset.client_name}, including all fields and uploaded files. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Fields by Category */}
      {Object.entries(groupedFields).map(([category, categoryFields]) => (
        <Card key={category} className="bg-card/50 backdrop-blur-sm border-2 border-border">
          <CardHeader>
            <CardTitle className="capitalize">{category.replace('_', ' ')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryFields.map((field) => (
              <div key={field.id} className="space-y-2">
                <label className="text-sm font-medium">{field.field_name}</label>
                {field.field_type === 'password' ? (
                  <div className="flex gap-2">
                    <div className="flex-1 px-3 py-2 bg-background border border-border rounded-md font-mono">
                      {visiblePasswords.has(field.id)
                        ? field.field_value
                        : '••••••••••••'}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePasswordVisibility(field.id)}
                    >
                      {visiblePasswords.has(field.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(field.field_value)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : field.field_type === 'file' ? (
                  <div className="text-sm text-muted-foreground">
                    See files section below
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 px-3 py-2 bg-background border border-border rounded-md">
                      {field.field_value || <span className="text-muted-foreground">Not provided</span>}
                    </div>
                    {field.field_value && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(field.field_value)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Files */}
      {files.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-2 border-border">
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-background border border-border rounded-md"
              >
                <div>
                  <p className="font-medium">{file.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.file_size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile(file.file_path, file.file_name)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
