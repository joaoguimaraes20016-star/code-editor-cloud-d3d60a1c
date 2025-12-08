import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

interface CreateFunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  onSuccess: (funnelId: string) => void;
}

export function CreateFunnelDialog({ open, onOpenChange, teamId, onSuccess }: CreateFunnelDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const finalSlug = slug || generateSlug(name);
      
      const { data, error } = await supabase
        .from('funnels')
        .insert({
          team_id: teamId,
          name,
          slug: finalSlug,
          created_by: user?.id,
          status: 'draft',
          settings: {
            logo_url: null,
            primary_color: '#00bcd4',
            background_color: '#000000',
            button_text: 'Continue',
            ghl_webhook_url: null,
          },
        })
        .select()
        .single();

      if (error) throw error;

      // Create default welcome and thank you steps
      const { error: stepsError } = await supabase
        .from('funnel_steps')
        .insert([
          {
            funnel_id: data.id,
            order_index: 0,
            step_type: 'welcome',
            content: {
              headline: 'Welcome',
              subtext: 'Start your journey with us',
              button_text: 'Get Started',
            },
          },
          {
            funnel_id: data.id,
            order_index: 1,
            step_type: 'thank_you',
            content: {
              headline: 'Thank You!',
              subtext: 'We will be in touch soon.',
            },
          },
        ]);

      if (stepsError) throw stepsError;

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['funnels', teamId] });
      toast({ title: 'Funnel created' });
      setName('');
      setSlug('');
      onSuccess(data.id);
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate key')) {
        toast({ title: 'URL slug already exists', description: 'Please choose a different slug', variant: 'destructive' });
      } else {
        toast({ title: 'Failed to create funnel', description: error.message, variant: 'destructive' });
      }
    },
  });

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug) {
      // Auto-generate slug as user types name
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Funnel</DialogTitle>
          <DialogDescription>
            Create a new lead capture funnel for your team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Funnel Name</Label>
            <Input
              id="name"
              placeholder="e.g., AI Academy Signup"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">/f/</span>
              <Input
                id="slug"
                placeholder={name ? generateSlug(name) : 'my-funnel'}
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will be the public URL for your funnel
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Funnel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
