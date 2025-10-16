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
    
    console.log('Checking for invitation token:', token);
    console.log('Full URL:', window.location.href);
    
    if (token) {
      // Check if user is already logged in
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          // User is logged in, process invitation immediately
          setLoading(true);
          try {
            const { data: invitation, error: inviteError } = await supabase
              .from('team_invitations')
              .select('*')
              .eq('token', token)
              .is('accepted_at', null)
              .maybeSingle();

            if (inviteError) throw inviteError;

            if (!invitation) {
              toast({
                title: 'Invalid invitation',
                description: 'This invitation link is not valid or has already been used.',
                variant: 'destructive',
              });
              setLoading(false);
              return;
            }

            // Check if invitation is expired
            const expiresAt = new Date(invitation.expires_at);
            if (expiresAt < new Date()) {
              toast({
                title: 'Invitation expired',
                description: 'This invitation link has expired.',
                variant: 'destructive',
              });
              setLoading(false);
              return;
            }

            // Check if user is already a team member
            const { data: existingMember } = await supabase
              .from('team_members')
              .select('id')
              .eq('team_id', invitation.team_id)
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (existingMember) {
              toast({
                title: 'Already a member',
                description: 'You are already a member of this team.',
              });
              navigate(`/team/${invitation.team_id}`);
              return;
            }

            // Add user to team
            const { error: insertError } = await supabase.from('team_members').insert({
              team_id: invitation.team_id,
              user_id: session.user.id,
              role: invitation.role,
            });

            if (insertError) throw insertError;

            // Mark invitation as accepted
            await supabase
              .from('team_invitations')
              .update({ accepted_at: new Date().toISOString() })
              .eq('id', invitation.id);

            toast({
              title: 'Welcome to the team!',
              description: 'You have been added to the team successfully.',
            });

            setTimeout(() => {
              navigate(`/team/${invitation.team_id}`);
            }, 500);
          } catch (err) {
            console.error('Error processing invitation:', err);
            toast({
              title: 'Error joining team',
              description: 'There was a problem adding you to the team. Please contact support.',
              variant: 'destructive',
            });
            setLoading(false);
          }
          return;
        }

        // User not logged in, load invitation for signup
        console.log('User not logged in, loading invitation for signup');
        supabase
          .from('team_invitations')
          .select('*')
          .eq('token', token)
          .is('accepted_at', null)
          .maybeSingle()
          .then(({ data, error }) => {
            console.log('Invitation query result:', { data, error });
            
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
    console.log('handleSignUp called, inviteToken:', inviteToken);
    setLoading(true);
    
    // Show initial feedback
    if (inviteToken) {
      toast({
        title: 'Creating your account...',
        description: 'Please wait while we set up your profile.',
      });
    }
    
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
    
    console.log('signUp result:', { signUpResult, error });
    
    if (error) {
      // If user already exists and has an invitation, sign them in instead
      if (error.message?.includes('already registered') && inviteToken) {
        const { error: signInError } = await signIn(signUpData.email, signUpData.password);
        
        if (signInError) {
          toast({
            title: 'Error signing in',
            description: 'Account exists but password is incorrect. Please reset your password or contact support.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // Get current user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          toast({
            title: 'Error',
            description: 'Could not get user session. Please try again.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // Process invitation for existing user
        try {
          const { data: invitation } = await supabase
            .from('team_invitations')
            .select('team_id, role, id')
            .eq('token', inviteToken)
            .maybeSingle();

          if (invitation) {
            // Check if user is already a team member
            const { data: existingMember } = await supabase
              .from('team_members')
              .select('id')
              .eq('team_id', invitation.team_id)
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!existingMember) {
              // Insert team member
              const { error: insertError } = await supabase.from('team_members').insert({
                team_id: invitation.team_id,
                user_id: session.user.id,
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
            }

            toast({
              title: 'Welcome to the team!',
              description: 'You have been added to the team successfully.',
            });
            
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
        
        setLoading(false);
        return;
      }

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
      console.log('Processing invitation for new user:', signUpResult.user.id);
      
      // Show progress
      toast({
        title: 'Account created!',
        description: 'Now adding you to the team...',
      });
      
      // Wait a moment for the session to be fully established
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Get the current session to ensure we're authenticated
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      console.log('Current session after signup:', currentSession?.user?.id);
      
      if (!currentSession) {
        toast({
          title: 'Session error',
          description: 'Please try signing in again to complete the invitation.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      
      try {
        const { data: invitation, error: inviteError } = await supabase
          .from('team_invitations')
          .select('team_id, role, id')
          .eq('token', inviteToken)
          .maybeSingle();

        console.log('Invitation data:', invitation, 'error:', inviteError);

        if (inviteError) throw inviteError;

        if (!invitation) {
          toast({
            title: 'Invitation not found',
            description: 'Could not find the invitation. Please contact the team owner.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // Insert team member
        const { error: insertError } = await supabase.from('team_members').insert({
          team_id: invitation.team_id,
          user_id: currentSession.user.id,
          role: invitation.role,
        });

        console.log('Insert team member error:', insertError);

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
          title: '🎉 Welcome to the team!',
          description: 'Taking you to your dashboard...',
        });
        
        // Redirect to the team dashboard with a delay for better UX
        setTimeout(() => {
          navigate(`/team/${invitation.team_id}`);
        }, 1500);
      } catch (err) {
        console.error('Error processing invitation:', err);
        toast({
          title: 'Error joining team',
          description: 'There was a problem adding you to the team. Please contact support.',
          variant: 'destructive',
        });
      }
      setLoading(false);
      return;
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
                  <div className="space-y-4">
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <h3 className="font-semibold text-lg mb-2">🎉 You're Invited!</h3>
                      <p className="text-sm text-muted-foreground">
                        Complete your profile below to join the team.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-email">Email Address</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        value={inviteEmail}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">Your invitation email</p>
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
                  <Label htmlFor="signup-name">Full Name *</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signUpData.fullName}
                    onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                    required
                  />
                  {inviteToken && (
                    <p className="text-xs text-muted-foreground">This will be your display name on the team</p>
                  )}
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
                  <Label htmlFor="signup-password">Create Password *</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">Use at least 6 characters for your password</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading} size="lg">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span> 
                      Creating account...
                    </span>
                  ) : inviteToken ? (
                    '✨ Join Team'
                  ) : (
                    'Sign Up'
                  )}
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
