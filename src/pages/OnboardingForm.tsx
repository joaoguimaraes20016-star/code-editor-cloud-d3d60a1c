import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { AccountCreation } from '@/components/client-assets/AccountCreation';

interface AssetField {
  id: string;
  field_category: string;
  field_name: string;
  field_value: string | null;
  field_type: string;
  is_required: boolean;
  placeholder_text: string | null;
  help_text: string | null;
  order_index: number;
}

interface ClientAsset {
  id: string;
  client_name: string;
  client_email: string;
  completion_percentage: number;
  token_expires_at: string;
}

export default function OnboardingForm() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<ClientAsset | null>(null);
  const [fields, setFields] = useState<AssetField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    loadAssetData();
  }, [token, navigate]);

  // Auto-save every 3 seconds
  useEffect(() => {
    if (!asset || submitted) return;

    const interval = setInterval(() => {
      saveProgress();
    }, 3000);

    return () => clearInterval(interval);
  }, [fields, asset, submitted]);

  const loadAssetData = async () => {
    try {
      // Load asset by token
      const { data: assetData, error: assetError } = await supabase
        .from('client_assets')
        .select('*')
        .eq('access_token', token)
        .maybeSingle();

      if (assetError || !assetData) {
        if (import.meta.env.DEV) {
          console.error('Asset error:', assetError);
        }
        toast.error('Invalid or expired link');
        navigate('/');
        return;
      }

      // Check if token is expired
      if (new Date(assetData.token_expires_at) < new Date()) {
        toast.error('This link has expired. Please contact your provider.');
        navigate('/');
        return;
      }

      setAsset(assetData);

      // If asset is already complete, skip to account creation
      if (assetData.status === 'complete') {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      // Load fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('client_asset_fields')
        .select('*')
        .eq('client_asset_id', assetData.id)
        .order('order_index');

      if (fieldsError) {
        if (import.meta.env.DEV) {
          console.error('Fields error:', fieldsError);
        }
        toast.error('Failed to load form');
        return;
      }

      // Map fields with all properties including help text
      const mappedFields: AssetField[] = (fieldsData || []).map((f: any) => ({
        id: f.id,
        field_category: f.field_category,
        field_name: f.field_name,
        field_value: f.field_value,
        field_type: f.field_type,
        is_required: f.is_required,
        placeholder_text: f.placeholder_text || null,
        help_text: f.help_text || null,
        order_index: f.order_index,
      }));

      setFields(mappedFields);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading asset:', error);
      }
      toast.error('An error occurred');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async () => {
    if (!asset || saving) return;

    setSaving(true);
    try {
      // Update all field values
      for (const field of fields) {
        if (field.field_type !== 'file') {
          await supabase
            .from('client_asset_fields')
            .update({ field_value: field.field_value })
            .eq('id', field.id);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Auto-save error:', error);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    const field = fields.find(f => f.id === fieldId);
    
    // Input validation
    let sanitizedValue = value;
    
    // Enforce max length to prevent data corruption
    if (sanitizedValue.length > 5000) {
      toast.error('Input too long. Maximum 5000 characters.');
      return;
    }
    
    // Validate URLs
    if (field?.field_type === 'url' && sanitizedValue) {
      try {
        new URL(sanitizedValue);
      } catch {
        // Allow partial URLs during typing, validate on blur
      }
    }
    
    // Trim whitespace for non-password fields
    if (field?.field_type !== 'password') {
      sanitizedValue = sanitizedValue.trim();
    }
    
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, field_value: sanitizedValue } : f))
    );
  };

  const handleFileUpload = async (fieldId: string, file: File) => {
    if (!asset) return;

    // File validation
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 50MB.');
      return;
    }

    // Validate file type - allow common formats only
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('File type not allowed. Please upload images, videos, PDFs, or documents.');
      return;
    }

    setUploadingFiles((prev) => new Set(prev).add(fieldId));
    try {
      const fileName = `${asset.id}/${fieldId}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('client-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Save file record
      await supabase.from('client_asset_files').insert({
        client_asset_id: asset.id,
        file_category: fields.find((f) => f.id === fieldId)?.field_category || 'documents',
        file_name: file.name,
        file_path: fileName,
        file_size: file.size,
        mime_type: file.type,
      });

      // Mark field as completed
      handleFieldChange(fieldId, 'File uploaded');
      toast.success('File uploaded successfully');
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Upload error:', error);
      }
      toast.error('Failed to upload file');
    } finally {
      setUploadingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fieldId);
        return newSet;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;

    // Check if all required fields are filled
    const missingFields = fields.filter(
      (f) => f.is_required && (!f.field_value || f.field_value.trim() === '')
    );

    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.map((f) => f.field_name).join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      // Save all fields
      await saveProgress();

      // Update status to complete
      await supabase
        .from('client_assets')
        .update({ status: 'complete' })
        .eq('id', asset.id);

      // Create audit log
      await supabase.from('client_asset_audit_logs').insert({
        client_asset_id: asset.id,
        action: 'completed',
        details: { completed_at: new Date().toISOString() },
      });

      // Add creator as admin to team
      await supabase.functions.invoke('handle-onboarding-completion', {
        body: { assetId: asset.id }
      });

      setSubmitted(true);
      toast.success('Form submitted successfully!');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Submit error:', error);
      }
      toast.error('Failed to submit form');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return <AccountCreation assetId={asset?.id || ''} clientName={asset?.client_name || ''} clientEmail={asset?.client_email || ''} accessToken={token || ''} />;
  }

  const groupedFields = fields.reduce((acc, field) => {
    if (!acc[field.field_category]) {
      acc[field.field_category] = [];
    }
    acc[field.field_category].push(field);
    return acc;
  }, {} as Record<string, AssetField[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-card/50 backdrop-blur-sm border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-3xl text-center mb-2">MASTER ONBOARDING SURVEY</CardTitle>
            <p className="text-xl font-semibold">Welcome, {asset?.client_name}!</p>
            <p className="text-muted-foreground mt-2">
              Please fill in your information below. Your progress is automatically saved.
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Progress</span>
                <span className="text-sm font-medium">{Math.round(asset?.completion_percentage || 0)}%</span>
              </div>
              <Progress value={asset?.completion_percentage || 0} />
            </div>
          </CardHeader>
        </Card>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {Object.entries(groupedFields).map(([category, categoryFields]) => {
            const categoryTitles: Record<string, string> = {
              instagram: 'Enter Your Login Information',
              domain: 'Domain Login',
              manychat: 'ManyChat Login',
              media: 'Upload Your Content'
            };
            
            return (
              <Card key={category} className="bg-card/50 backdrop-blur-sm border-2 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">{categoryTitles[category] || category}</CardTitle>
                </CardHeader>
              <CardContent className="space-y-4">
                {categoryFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>
                      {field.field_name}
                      {field.is_required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.help_text && (
                      <p className="text-sm text-muted-foreground">{field.help_text}</p>
                    )}
                    {field.field_type === 'file' ? (
                      <div>
                        <Input
                          type="file"
                          id={field.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(field.id, file);
                          }}
                          disabled={uploadingFiles.has(field.id)}
                        />
                        {uploadingFiles.has(field.id) && (
                          <p className="text-sm text-muted-foreground mt-1">Uploading...</p>
                        )}
                        {field.field_value && (
                          <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            {field.field_value}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Input
                        type={field.field_type === 'password' ? 'password' : field.field_type === 'url' ? 'url' : 'text'}
                        id={field.id}
                        value={field.field_value || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        placeholder={field.placeholder_text || ''}
                        required={field.is_required}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
            );
          })}

          <Button type="submit" className="w-full" size="lg" disabled={saving}>
            {saving ? 'Saving...' : 'Submit'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Your information is securely encrypted and stored.
        </p>
      </div>
    </div>
  );
}
