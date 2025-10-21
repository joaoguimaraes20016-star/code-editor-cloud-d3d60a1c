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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { getUserFriendlyError } from '@/lib/errorUtils';

interface NewClientAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId?: string;
  availableTeams?: { id: string; name: string }[];
}

export function NewClientAssetDialog({
  open,
  onOpenChange,
  teamId,
  availableTeams = [],
}: NewClientAssetDialogProps) {
  const { user } = useAuth();
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState(teamId || '');
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

    if (!selectedTeamId) {
      toast.error('Please select a team');
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

      // Create client asset
      const { data: asset, error: assetError } = await supabase
        .from('client_assets')
        .insert({
          team_id: selectedTeamId,
          client_name: clientName,
          client_email: clientEmail,
          access_token: accessToken,
          created_by: user.id,
          status: 'not_started',
        })
        .select()
        .single();

      if (assetError) throw assetError;

      // Load team-specific templates first, then default templates
      const { data: teamTemplates } = await supabase
        .from('asset_field_templates')
        .select('*')
        .eq('team_id', selectedTeamId)
        .eq('is_active', true)
        .order('order_index');

      const { data: defaultTemplates } = await supabase
        .from('asset_field_templates')
        .select('*')
        .is('team_id', null)
        .eq('is_active', true)
        .order('order_index');

      const templates = [...(teamTemplates || []), ...(defaultTemplates || [])];
      const templatesError = null;

      if (templatesError) throw templatesError;

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

      const { error: fieldsError } = await supabase
        .from('client_asset_fields')
        .insert(fields);

      if (fieldsError) throw fieldsError;

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

      // Get team name
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', selectedTeamId)
        .single();

      // Send onboarding email
      try {
        const { error: emailError } = await supabase.functions.invoke('send-onboarding-email', {
          body: {
            clientName,
            clientEmail,
            onboardingUrl: link,
            teamName: team?.name || 'Our Team',
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
    setSelectedTeamId(teamId || '');
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
            {availableTeams.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="team">Assign to Team</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger id="team">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
