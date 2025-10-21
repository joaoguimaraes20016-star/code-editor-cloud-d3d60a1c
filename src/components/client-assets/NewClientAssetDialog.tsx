import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { getUserFriendlyError } from '@/lib/errorUtils';

interface NewClientAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewClientAssetDialog({
  open,
  onOpenChange,
}: NewClientAssetDialogProps) {
  const { user } = useAuth();
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const generateSecureToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  };

  const handleCreate = async () => {
    if (!clientName.trim() || !clientEmail.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setLoading(true);

    try {
      // Generate cryptographically secure token
      const accessToken = generateSecureToken();

      // Create client asset without team_id (will be assigned during onboarding)
      const { data: asset, error: assetError } = await supabase
        .from('client_assets')
        .insert({
          team_id: null,
          client_name: clientName,
          client_email: clientEmail,
          access_token: accessToken,
          created_by: user.id,
          status: 'not_started',
        })
        .select()
        .single();

      if (assetError) throw assetError;

      // Load only default templates (team-specific templates will be added after team creation)
      const { data: defaultTemplates } = await supabase
        .from('asset_field_templates')
        .select('*')
        .is('team_id', null)
        .eq('is_active', true)
        .order('order_index');

      const templates = defaultTemplates || [];

      // Create fields from templates
      const fields = templates.map((template) => ({
        client_asset_id: asset.id,
        field_category: template.field_category,
        field_name: template.field_name,
        field_type: template.field_type,
        is_required: template.is_required,
        order_index: template.order_index,
        field_value: null,
      }));

      if (fields.length > 0) {
        const { error: fieldsError } = await supabase
          .from('client_asset_fields')
          .insert(fields);

        if (fieldsError) throw fieldsError;
      }

      // Create audit log
      await supabase.from('client_asset_audit_logs').insert({
        client_asset_id: asset.id,
        action: 'created',
        user_id: user.id,
        details: { client_name: clientName, client_email: clientEmail },
      });

      // Generate link
      const link = `${window.location.origin}/onboard/${accessToken}`;
      setGeneratedLink(link);

      // Send onboarding email
      try {
        const { error: emailError } = await supabase.functions.invoke('send-onboarding-email', {
          body: {
            clientName,
            clientEmail,
            onboardingUrl: link,
            teamName: 'GRWTH OP',
          },
        });

        if (emailError) {
          console.error('Email error:', emailError);
          toast.warning('Link created but email failed to send. Copy the link below.');
        } else {
          toast.success(`Onboarding email sent to ${clientEmail}`);
        }
      } catch (emailError) {
        console.error('Email error:', emailError);
        toast.warning('Link created but email failed to send. Copy the link below.');
      }
    } catch (error) {
      console.error('Error creating client asset:', error);
      toast.error(getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.success('Link copied to clipboard');
    }
  };

  const handleClose = () => {
    setClientName('');
    setClientEmail('');
    setGeneratedLink(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Client Asset</DialogTitle>
          <DialogDescription>
            Generate a secure onboarding link for a new client
          </DialogDescription>
        </DialogHeader>

        {generatedLink ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <Label>Onboarding Link</Label>
              <div className="flex gap-2">
                <Input value={generatedLink} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="sm" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Share this link with {clientName}. It expires in 30 days.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The client will automatically create their team when they complete onboarding.
            </p>

            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientEmail">Client Email</Label>
              <Input
                id="clientEmail"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {generatedLink ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? 'Creating...' : 'Generate Link'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
