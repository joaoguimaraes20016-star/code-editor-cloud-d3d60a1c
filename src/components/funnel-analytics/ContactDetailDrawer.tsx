import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  X, Phone, Mail, User, MessageSquare, Clock, 
  ExternalLink, Copy, CheckCircle, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from '@/components/ui/sheet';

interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  opt_in: boolean;
  source: string | null;
  calendly_booked_at: string | null;
  custom_fields: Record<string, any> | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface ContactDetailDrawerProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDetailDrawer({ contact, open, onOpenChange }: ContactDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState('profile');

  if (!contact) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const initials = contact.name 
    ? contact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : contact.email?.charAt(0).toUpperCase() || '?';

  // Parse custom_fields as funnel answers
  const funnelAnswers = contact.custom_fields && typeof contact.custom_fields === 'object'
    ? Object.entries(contact.custom_fields).filter(([key, value]) => value && key !== 'undefined')
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 overflow-hidden">
        <ScrollArea className="h-full">
          {/* Header with avatar and quick actions */}
          <div className="bg-gradient-to-br from-muted/50 to-muted p-6 text-center relative">
            <button 
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-background/50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            
            <div className="w-20 h-20 rounded-full bg-primary/10 border-4 border-background mx-auto flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-primary">{initials}</span>
            </div>
            
            <h2 className="text-xl font-bold text-foreground">
              {contact.name || contact.email || 'Unknown Contact'}
            </h2>
            
            <div className="flex items-center justify-center gap-2 mt-2">
              {contact.opt_in ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Opted In
                </Badge>
              ) : (
                <Badge variant="outline">New</Badge>
              )}
            </div>
            
            {/* Quick action buttons */}
            <div className="flex items-center justify-center gap-3 mt-4">
              {contact.phone && (
                <Button 
                  variant="outline" 
                  size="icon"
                  className="rounded-full h-11 w-11 bg-background"
                  onClick={() => window.open(`https://wa.me/${contact.phone.replace(/\D/g, '')}`, '_blank')}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              )}
              {contact.email && (
                <Button 
                  variant="outline" 
                  size="icon"
                  className="rounded-full h-11 w-11 bg-background"
                  onClick={() => window.open(`mailto:${contact.email}`, '_blank')}
                >
                  <Mail className="h-4 w-4" />
                </Button>
              )}
              {contact.phone && (
                <Button 
                  variant="outline" 
                  size="icon"
                  className="rounded-full h-11 w-11 bg-background"
                  onClick={() => window.open(`tel:${contact.phone}`, '_blank')}
                >
                  <Phone className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
              <TabsTrigger 
                value="profile" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                Profile
              </TabsTrigger>
              <TabsTrigger 
                value="notes" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                Notes
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="p-6 space-y-6 mt-0">
              {/* Funnel Answers / Notes Section */}
              {funnelAnswers.length > 0 && (
                <div className="space-y-3">
                  {funnelAnswers.map(([question, answer], index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{question}</span>
                      </div>
                      <div className="ml-6 px-3 py-2 bg-muted rounded-lg">
                        <p className="text-sm font-medium">{String(answer)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Contact Info */}
              <div className="space-y-4">
                {contact.name && (
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="text-sm font-medium">{contact.name}</p>
                    </div>
                  </div>
                )}
                
                {contact.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{contact.email}</p>
                        <button 
                          onClick={() => copyToClipboard(contact.email!, 'Email')}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {contact.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{contact.phone}</p>
                        <button 
                          onClick={() => copyToClipboard(contact.phone!, 'Phone')}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {contact.opt_in && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Privacy Policy</p>
                      <p className="text-sm font-medium">Accepted</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="notes" className="p-6 mt-0">
              {funnelAnswers.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Funnel Responses</h3>
                  {funnelAnswers.map(([question, answer], index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <p className="text-xs text-muted-foreground">{question}</p>
                      <p className="text-sm">{String(answer)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notes or responses yet</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="p-6 mt-0">
              <div className="space-y-4">
                {/* Source info */}
                <div className="flex items-start gap-3 pb-4 border-b">
                  <div className="p-2 rounded-full bg-blue-500/10">
                    <ExternalLink className="h-3 w-3 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Captured from funnel</p>
                    <p className="text-xs text-muted-foreground">{contact.source || 'Direct'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Created at */}
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-muted">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Contact created</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(contact.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>

                {/* Last updated */}
                {contact.updated_at !== contact.created_at && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-muted">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Last updated</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(contact.updated_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
