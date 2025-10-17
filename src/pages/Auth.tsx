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
  const [inviteTeamName, setInviteTeamName] = useState('');
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  // Check URL params immediately to set initial tab
  const urlParams = new URLSearchParams(location.search);
  const hasInvite = urlParams.get('invite');
  const hasCreator = urlParams.get('creator');
  const [activeTab, setActiveTab] = useState(hasInvite || hasCreator ? 'signup' : 'signin');
  const [isCreatorUpgrade, setIsCreatorUpgrade] = useState(false);
  const [creatorCode, setCreatorCode] = useState('');



  useEffect(() => {
    // Check for invitation token or creator upgrade in URL
    const params = new URLSearchParams(location.search);
    const token = params.get('invite');
    const creatorParam = params.get('creator');
    
    console.log('=== AUTH PAGE LOADED ===');
    console.log('Full URL:', window.location.href);
    console.log('Search params:', location.search);
    console.log('Invite token from URL:', token);
    console.log('Creator param:', creatorParam);
    console.log('Full URL:', window.location.href);
    
    // Check if this is a creator upgrade request
    if (creatorParam === 'true') {
      console.log('Processing creator upgrade...');
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setSignUpData({ email: session.user.email || '', password: '', fullName: '', signupCode: '' });
          setIsCreatorUpgrade(true);
          setActiveTab('signup');
        }
      });
      return;
    }
    
    if (token) {
      console.log('=== INVITATION TOKEN DETECTED ===');
      setInviteLoading(true);
      setActiveTab('signup');
      
      // Load invitation data - ignore login state
      supabase
        .from('team_invitations')
        .select('*, teams(name)')
        .eq('token', token)
        .is('accepted_at', null)
        .maybeSingle()
        .then(({ data, error }) => {
          console.log('=== INVITATION QUERY RESULT ===');
          console.log('Data:', data);
          
          if (error || !data) {
            toast({
              title: 'Invalid invitation',
              description: 'This invitation link is not valid or has already been used.',
              variant: 'destructive',
            });
            setInviteLoading(false);
            return;
          }

          // Check expiration
          if (new Date(data.expires_at) < new Date()) {
            toast({
              title: 'Invitation expired',
              description: 'This invitation link has expired.',
              variant: 'destructive',
            });
            setInviteLoading(false);
            return;
          }

          // Set invitation mode
          setInviteToken(token);
          setInviteEmail(data.email);
          setInviteTeamName((data.teams as any)?.name || 'the team');
          setInviteMode(true);
          setSignUpData({ email: data.email, password: '', fullName: '', signupCode: '' });
          setInviteLoading(false);
          
          toast({
            title: 'Welcome!',
            description: `You've been invited to join ${(data.teams as any)?.name}`,
          });
        });
      return;
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
      setLoading(false);
      return;
    }

    // Check if this user has a pending invitation
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && inviteToken) {
      try {
        const { data: invitation } = await supabase
          .from('team_invitations')
          .select('team_id, role, id')
          .eq('token', inviteToken)
          .eq('email', session.user.email?.toLowerCase())
          .is('accepted_at', null)
          .maybeSingle();

        if (invitation) {
          // Add user to team
          await supabase.from('team_members').insert({
            team_id: invitation.team_id,
            user_id: session.user.id,
            role: invitation.role,
          });

          // Mark invitation as accepted
          await supabase
            .from('team_invitations')
            .update({ accepted_at: new Date().toISOString() })
            .eq('id', invitation.id);

          toast({
            title: '🎉 Welcome to the team!',
            description: 'Taking you to your dashboard...',
          });

          setTimeout(() => {
            navigate(`/team/${invitation.team_id}`);
          }, 1000);
          return;
        }
      } catch (err) {
        console.error('Error processing invitation on sign in:', err);
      }
    }

    toast({
      title: 'Welcome back!',
      description: 'Successfully signed in',
    });
    navigate('/dashboard');
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSignUp called, inviteToken:', inviteToken);
    setLoading(true);
    
    // Handle creator upgrade
    if (isCreatorUpgrade) {
      if (creatorCode.trim().toUpperCase() !== 'CREATOR2025') {
        toast({
          title: 'Invalid creator code',
          description: 'Please enter a valid creator code.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ account_type: 'creator' })
          .eq('id', user.id);

        if (updateError) {
          toast({
            title: 'Error upgrading account',
            description: updateError.message,
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        toast({
          title: 'Success!',
          description: 'You are now a creator. You can create teams.',
        });
        navigate('/dashboard');
        setLoading(false);
        return;
      }
    }
    
    // Show initial feedback
    if (inviteToken) {
      toast({
        title: 'Creating your account...',
        description: 'Please wait while we set up your profile.',
      });
    }
    
    // Skip signup code validation if user has an invitation
    if (!inviteToken) {
      if (signUpData.signupCode.trim().toUpperCase() !== 'CREATOR2025') {
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

    // If user signed up with an invitation, process it immediately
    if (inviteToken && signUpResult?.user) {
      console.log('Account created for invited user:', signUpResult.user.id);
      
      // Set account_type to 'invited' for users signing up with invitation
      await supabase
        .from('profiles')
        .update({ account_type: 'invited' })
        .eq('id', signUpResult.user.id);
      
      // Process invitation for new user (they're already logged in)
      try {
        const { data: invitation } = await supabase
          .from('team_invitations')
          .select('team_id, role, id')
          .eq('token', inviteToken)
          .maybeSingle();

        if (invitation) {
          // Add user to team
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
            title: '🎉 Welcome to the team!',
            description: `You're all set! Taking you to your dashboard...`,
          });

          setTimeout(() => {
            navigate(`/team/${invitation.team_id}`);
          }, 1000);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Error processing invitation:', err);
        toast({
          title: 'Error joining team',
          description: 'There was a problem adding you to the team. Please contact support.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
    } else {
      // Set account_type to 'creator' for regular signups with code
      if (signUpResult?.user) {
        await supabase
          .from('profiles')
          .update({ account_type: 'creator' })
          .eq('id', signUpResult.user.id);
      }
      
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
      navigate('/dashboard');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 md:p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center px-4 md:px-6 py-4 md:py-6">
          <CardTitle className="text-2xl md:text-3xl font-bold">
            {inviteMode ? '🎉 Welcome to the Team!' : 'GRWTH'}
          </CardTitle>
          <CardDescription className="text-sm md:text-base">
            {isResettingPassword 
              ? 'Reset your password' 
              : inviteMode 
              ? `Create your account for ${inviteTeamName}`
              : inviteLoading
              ? 'Loading invitation...'
              : 'Track your sales performance'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 md:px-6 py-4 md:py-6">
          {inviteLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin text-4xl">⏳</div>
            </div>
          ) : inviteMode ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 space-y-3">
                <h3 className="font-semibold text-lg">Welcome to {inviteTeamName}! 🎉</h3>
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-2">
                    <span className="font-semibold">📧 Email:</span>
                    <span className="text-muted-foreground">{inviteEmail}</span>
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create your account to get started with the team
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="invite-fullname">Your Full Name</Label>
                <Input
                  id="invite-fullname"
                  type="text"
                  placeholder="John Doe"
                  value={signUpData.fullName}
                  onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="invite-password">Choose Your Password</Label>
                <Input
                  id="invite-password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={signUpData.password}
                  onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">Create a secure password for your account</p>
              </div>
              
              <Button type="submit" className="w-full" disabled={loading} size="lg">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span> 
                    Creating your account...
                  </span>
                ) : (
                  'Create Account & Join Team'
                )}
              </Button>
              
              <div className="text-center pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setInviteMode(false);
                      setActiveTab('signin');
                      setSignInData({ email: inviteEmail, password: '' });
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </form>
          ) : isResettingPassword ? (
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
            <TabsList className="grid w-full grid-cols-2 h-auto">
              <TabsTrigger value="signin" className="text-sm md:text-base py-2 md:py-2.5">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="text-sm md:text-base py-2 md:py-2.5">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              {inviteToken && (
                <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm">
                    💡 <strong>Already have an account?</strong> Sign in below to join the team.
                  </p>
                </div>
              )}
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
                    {loading ? 'Signing in...' : inviteToken ? 'Sign In & Join Team' : 'Sign In'}
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
                {isCreatorUpgrade && (
                  <div className="space-y-4">
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <h3 className="font-semibold text-lg mb-2">🚀 Upgrade to Creator</h3>
                      <p className="text-sm text-muted-foreground">
                        Enter your creator code to unlock the ability to create teams.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="upgrade-email">Email Address</Label>
                      <Input
                        id="upgrade-email"
                        type="email"
                        value={signUpData.email}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="creator-code">Creator Code</Label>
                      <Input
                        id="creator-code"
                        type="text"
                        placeholder="Enter your creator code"
                        value={creatorCode}
                        onChange={(e) => setCreatorCode(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading} size="lg">
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⏳</span> 
                          Upgrading...
                        </span>
                      ) : (
                        '✨ Upgrade to Creator'
                      )}
                    </Button>
                  </div>
                )}
                {!isCreatorUpgrade && inviteToken && (
                  <>
                    <div className="space-y-4">
                      <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                        <h3 className="font-semibold text-lg mb-2">🎉 You're Invited to Join a Team!</h3>
                        <p className="text-sm text-muted-foreground">
                          Don't have an account? Create one below to join the team.
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Already have an account? Switch to the <strong>Sign In</strong> tab.
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
                        <p className="text-xs text-muted-foreground">This is the email that received the invitation</p>
                      </div>
                    </div>
                    <div className="hidden">DEBUG: inviteToken={inviteToken}, inviteEmail={inviteEmail}</div>
                  </>
                )}
                {!isCreatorUpgrade && !inviteToken && (
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
                {!isCreatorUpgrade && (
                  <>
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
                  </>
                )}
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
