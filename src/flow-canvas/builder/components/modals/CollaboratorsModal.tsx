import React, { useState } from 'react';
import { Copy, Check, Mail, Link as LinkIcon, Users, Crown, Clock, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface CollaboratorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageSlug: string;
}

export const CollaboratorsModal: React.FC<CollaboratorsModalProps> = ({
  isOpen,
  onClose,
  pageSlug,
}) => {
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const shareUrl = `https://yoursite.app/${pageSlug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = () => {
    if (!email.trim()) return;
    if (!email.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }
    setInvitedEmails(prev => [...prev, email]);
    toast.success(`Invitation sent to ${email}`);
    setEmail('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInvite();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-builder-surface border-builder-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-builder-text flex items-center gap-2">
            <Users className="w-5 h-5 text-builder-accent" />
            Share & Collaborate
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Share Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-builder-text">Share Link</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-builder-bg border border-builder-border rounded-lg">
                <LinkIcon className="w-4 h-4 text-builder-text-muted shrink-0" />
                <span className="text-sm text-builder-text-secondary truncate">{shareUrl}</span>
              </div>
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="border-builder-border text-builder-text hover:bg-builder-surface-hover shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Invite by Email */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-builder-text">Invite by Email</label>
              <Badge variant="secondary" className="text-[10px] bg-builder-accent/10 text-builder-accent border-none">
                Coming Soon
              </Badge>
            </div>
            <div className="flex gap-2">
              <Input
                disabled
                placeholder="Coming soon..."
                className="builder-input flex-1 opacity-50 cursor-not-allowed"
                type="email"
              />
              <Button
                disabled
                className="bg-builder-accent/50 text-white/50 cursor-not-allowed"
              >
                <Mail className="w-4 h-4 mr-2" />
                Invite
              </Button>
            </div>
            <p className="text-xs text-builder-text-dim flex items-center gap-1">
              <Info className="w-3 h-3" />
              Collaborators will be able to view and edit this project
            </p>
          </div>

          {/* Current Owner */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-builder-text">Team Members</label>
            <div className="space-y-2">
              {/* Owner */}
              <div className="flex items-center gap-3 p-3 bg-builder-bg border border-builder-border rounded-lg">
                <div className="w-8 h-8 rounded-full bg-builder-accent/20 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-builder-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-builder-text font-medium">You</p>
                  <p className="text-xs text-builder-text-muted">Owner</p>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-500 border-none">
                  Active
                </Badge>
              </div>
              
              {/* Invited collaborators */}
              {invitedEmails.map((invitedEmail, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-builder-bg border border-builder-border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-builder-surface-hover flex items-center justify-center">
                    <Mail className="w-4 h-4 text-builder-text-muted" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-builder-text font-medium">{invitedEmail}</p>
                    <p className="text-xs text-builder-text-muted">Editor</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-yellow-500/10 text-yellow-500 border-none flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending
                  </Badge>
                </div>
              ))}
              
              {invitedEmails.length === 0 && (
                <div className="p-4 text-center border border-dashed border-builder-border rounded-lg">
                  <p className="text-sm text-builder-text-muted">No collaborators invited yet</p>
                  <p className="text-xs text-builder-text-dim mt-1">Invite team members to collaborate on this project</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
