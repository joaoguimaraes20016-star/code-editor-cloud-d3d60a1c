import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState({ email: '', password: '', fullName: '', signupCode: '' });
  const [resetEmail, setResetEmail] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [linkExpired, setLinkExpired] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [activeTab, setActiveTab] = useState('signin');



  useEffect(() => {
    // Check for invitation token in URL
    const params = new URLSearchParams(location.search);
    const token = params.get('invite');
    
    if (token) {
      // Load invitation details
      supabase
        .from('team_invitations')
        .select('*')
        .eq('token', token)
        .is('accepted_at', null)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            toast({
              title: 'Error loading invitation',
              description: error.message,
              variant: 'destructive',
            });
            return;
          }

          if (!data) {
            toast({
              title: 'Invalid invitation',
              description: 'This invitation link is not valid or has already been used.',
              variant: 'destructive',
            });
            return;
          }

          // Check if invitation is expired
          const expiresAt = new Date(data.expires_at);
          if (expiresAt < new Date()) {
            toast({
              title: 'Invitation expired',
              description: 'This invitation link has expired.',
              variant: 'destructive',
            });
            return;
          }

          setInviteToken(token);
          setInviteEmail(data.email);
          setSignUpData(prev => ({ ...prev, email: data.email }));
          setActiveTab('signup');
        });
      return; // Don't process password reset if invitation is present
    }

    // Set up auth state listener to catch PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
        setUserEmail(session?.user?.email || '');
        setNewPassword('');
        setConfirmPassword('');
      }
    });

    // Also check current state on mount
    const checkCurrentState = async () => {
      const hash = window.location.hash;
      
      if (hash.includes('type=recovery')) {
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user?.email) {
            setIsResettingPassword(true);
            setUserEmail(session.user.email);
          }
        }, 1000);
      }
      
      if (hash.includes('error=access_denied')) {
        setShowResetForm(true);
        toast({
          title: 'Link expired',
          description: 'Please request a new password reset link.',
          variant: 'destructive',
        });
        window.history.replaceState({}, '', '/auth');
      }
    };
    
    checkCurrentState();

    return () => {
      subscription.unsubscribe();
    };
  }, [toast, location]);


  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(signInData.email, signInData.password);
    
    if (error) {
      toast({
        title: 'Error signing in',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Welcome back!',
        description: 'Successfully signed in',
      });
      navigate('/');
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Skip signup code validation if user has an invitation
    if (!inviteToken) {
      if (signUpData.signupCode.trim().toUpperCase() !== 'GRWTHCO25') {
        toast({
          title: 'Invalid signup code',
          description: 'Please enter a valid signup code to create an account.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
    }
    
    const { data: signUpResult, error } = await signUp(signUpData.email, signUpData.password, signUpData.fullName);
    
    if (error) {
      toast({
        title: 'Error signing up',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // If user signed up with an invitation, add them to the team
    if (inviteToken && signUpResult?.user) {
      try {
        const { data: invitation } = await supabase
          .from('team_invitations')
          .select('team_id, role, id')
          .eq('token', inviteToken)
          .single();

        if (invitation) {
          // Insert team member
          const { error: insertError } = await supabase.from('team_members').insert({
            team_id: invitation.team_id,
            user_id: signUpResult.user.id,
            role: invitation.role,
          });

          if (insertError) {
            console.error('Error inserting team member:', insertError);
            throw insertError;
          }

          // Mark invitation as accepted
          await supabase
            .from('team_invitations')
            .update({ accepted_at: new Date().toISOString() })
            .eq('id', invitation.id);

          toast({
            title: 'Welcome to the team!',
            description: 'Your account has been created successfully.',
          });
          
          // Redirect to the team dashboard
          setTimeout(() => {
            navigate(`/team/${invitation.team_id}`);
          }, 500);
        }
      } catch (err) {
        console.error('Error processing invitation:', err);
        toast({
          title: 'Error joining team',
          description: 'There was a problem adding you to the team. Please contact support.',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Check your email!',
        description: 'We sent you a confirmation link. Please verify your email to continue.',
      });
    }
    
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await resetPassword(resetEmail);
    
    if (error) {
      toast({
        title: 'Error sending reset email',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Check your email!',
        description: 'We sent you a password reset link.',
      });
      setShowResetForm(false);
      setResetEmail('');
    }
    
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are identical.',
        variant: 'destructive',
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) {
      toast({
        title: 'Error updating password',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Password updated!',
        description: 'Your password has been successfully updated.',
      });
      setIsResettingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      navigate('/');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">GRWTH</CardTitle>
          <CardDescription>
            {isResettingPassword ? 'Reset your password' : 'Track your sales performance'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isResettingPassword ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email-display">Email</Label>
                <Input
                  id="reset-email-display"
                  type="email"
                  value={userEmail}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Confirm new password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin" disabled={!!inviteToken}>Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              {!showResetForm ? (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowResetForm(true)}
                    className="text-sm text-primary hover:underline w-full text-center"
                  >
                    Forgot Password?
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowResetForm(false)}
                    className="text-sm text-primary hover:underline w-full text-center"
                  >
                    Back to Sign In
                  </button>
                </form>
              )}
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {inviteToken && (
                  <div className="space-y-3">
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <h3 className="font-semibold mb-1">Welcome!</h3>
                      <p className="text-sm text-muted-foreground">
                        You've been invited to join a team. Complete your profile to get started.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-email">Email</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        value={inviteEmail}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>
                )}
                {!inviteToken && (
                  <div className="space-y-2">
                    <Label htmlFor="signup-code">Signup Code</Label>
                    <Input
                      id="signup-code"
                      type="text"
                      placeholder="Enter your signup code"
                      value={signUpData.signupCode}
                      onChange={(e) => setSignUpData({ ...signUpData, signupCode: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your full name"
                    value={signUpData.fullName}
                    onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                    required
                  />
                </div>
                {!inviteToken && (
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Set Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password (min 6 characters)"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : inviteToken ? 'Join Team' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
