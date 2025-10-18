import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TeamMemberWithBooking {
  user_id: string;
  role: string;
  booking_code: string | null;
  profiles: {
    full_name: string;
  };
}

interface SetterBookingLinksProps {
  teamId: string;
  calendlyEventTypes: string[];
}

export function SetterBookingLinks({ teamId, calendlyEventTypes }: SetterBookingLinksProps) {
  const [members, setMembers] = useState<TeamMemberWithBooking[]>([]);
  const [editingCodes, setEditingCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMembers();
  }, [teamId]);

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('user_id, role, booking_code, profiles!inner(full_name)')
        .eq('team_id', teamId)
        .in('role', ['setter', 'closer', 'admin']);

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCodeFromName = (fullName: string): string => {
    const parts = fullName.toLowerCase().trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 8);
    return `${parts[0]}_${parts[parts.length - 1].charAt(0)}`;
  };

  const handleSaveCode = async (userId: string, code: string) => {
    if (!code.trim()) {
      toast({
        title: 'Error',
        description: 'Booking code cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    setSaving(userId);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ booking_code: code.trim().toLowerCase() })
        .eq('team_id', teamId)
        .eq('user_id', userId);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Error',
            description: 'This booking code is already in use',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: 'Success',
          description: 'Booking code saved',
        });
        loadMembers();
        setEditingCodes((prev) => {
          const newCodes = { ...prev };
          delete newCodes[userId];
          return newCodes;
        });
      }
    } catch (error) {
      console.error('Error saving booking code:', error);
      toast({
        title: 'Error',
        description: 'Failed to save booking code',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const getBookingLink = (bookingCode: string): string => {
    if (!calendlyEventTypes.length) return '';
    const eventTypeUrl = calendlyEventTypes[0];
    return `${eventTypeUrl}?utm_source=setter_${bookingCode}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading booking links...</div>;
  }

  if (!calendlyEventTypes.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Setter Booking Links</CardTitle>
          <CardDescription>
            Configure Calendly event types first to enable personalized booking links
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!members.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Setter Booking Links</CardTitle>
          <CardDescription>
            No team members with setter, closer, or admin roles found
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Setter Booking Links</CardTitle>
        <CardDescription>
          Create personalized booking links that automatically assign appointments to specific team members
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.map((member) => {
          const currentCode = editingCodes[member.user_id] ?? member.booking_code ?? '';
          const hasBookingCode = !!member.booking_code;
          const bookingLink = hasBookingCode ? getBookingLink(member.booking_code) : '';

          return (
            <div key={member.user_id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{member.profiles.full_name}</p>
                  <Badge variant="secondary" className="mt-1">
                    {member.role}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Booking Code</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., john_s"
                    value={currentCode}
                    onChange={(e) =>
                      setEditingCodes((prev) => ({
                        ...prev,
                        [member.user_id]: e.target.value,
                      }))
                    }
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSaveCode(member.user_id, currentCode)}
                    disabled={saving === member.user_id || currentCode === member.booking_code}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  {!member.booking_code && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const generated = generateCodeFromName(member.profiles.full_name);
                        setEditingCodes((prev) => ({
                          ...prev,
                          [member.user_id]: generated,
                        }));
                      }}
                    >
                      Auto-generate
                    </Button>
                  )}
                </div>
              </div>

              {hasBookingCode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Personalized Booking Link</label>
                  <div className="flex gap-2">
                    <Input
                      value={bookingLink}
                      readOnly
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(bookingLink, 'Booking link')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(bookingLink, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Appointments booked through this link will automatically assign to{' '}
                    {member.profiles.full_name}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
