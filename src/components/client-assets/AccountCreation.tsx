import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AccountCreationProps {
  assetId: string;
  clientName: string;
  clientEmail: string;
  accessToken: string;
}

export function AccountCreation({ assetId, clientName, clientEmail, accessToken }: AccountCreationProps) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [teamName, setTeamName] = useState('');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    if (teamName.trim().length > 100) {
      toast.error('Team name must be less than 100 characters');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setCreating(true);
    try {
      // Call edge function to create account + team + assign role
      const { data, error } = await supabase.functions.invoke('create-client-account', {
        body: {
          email: clientEmail,
          password,
          fullName: clientName,
          clientAssetId: assetId,
          teamName: teamName.trim(),
          accessToken: accessToken,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create account');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('Account creation response:', data);
      
      // Sign in the user automatically
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: clientEmail,
        password,
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        toast.error(`Account created! ${signInError.message}. Please sign in manually.`);
        // Wait 2 seconds then redirect to login page
        setTimeout(() => {
          navigate('/', { state: { email: clientEmail } });
        }, 2000);
      } else {
        setAccountCreated(true);
        const message = data?.isNewUser ? 'Account created successfully!' : 'Welcome back! Your account has been linked.';
        toast.success(message);
        
        // Redirect to client assets page after 2 seconds
        setTimeout(() => {
          navigate('/client-assets');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Account creation error:', error);
      const errorMessage = error.message || 'Failed to create account. Please try again.';
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  if (accountCreated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card/50 backdrop-blur-sm border-2 border-primary/20">
          <CardContent className="pt-12 pb-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Welcome Aboard!</h2>
            <p className="text-muted-foreground mb-4">
              Your account and team dashboard have been created successfully.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-card/50 backdrop-blur-sm border-2 border-primary/20">
        <CardHeader>
          <div className="text-center mb-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl mb-2">Thank You!</CardTitle>
            <CardDescription>
              Your information has been submitted successfully.
            </CardDescription>
          </div>
          <div className="border-t pt-6">
            <CardTitle className="text-xl mb-2">Create Your Account</CardTitle>
            <CardDescription>
              Set up your account to access your personalized dashboard and track your progress.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={clientName} disabled />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={clientEmail} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamName">
                Team Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="teamName"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter your team or company name"
                required
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                This will be the name of your workspace
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                Confirm Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Your Account...
                </>
              ) : (
                'Create Account & Access Dashboard'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By creating an account, you'll get access to your personalized dashboard
              where you can track your progress and update your information.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}