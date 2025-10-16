import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('=== Auth Callback Started ===');
        console.log('Full URL:', window.location.href);
        
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get('token_hash');
        const type = params.get('type');
        
        console.log('Token hash present:', !!tokenHash);
        console.log('Type:', type);
        
        if (!tokenHash || !type) {
          console.log('Missing token_hash or type, redirecting to auth');
          navigate('/auth');
          return;
        }

        if (type === 'recovery') {
          console.log('Verifying recovery token...');
          
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          
          if (verifyError) {
            console.error('Verification error:', verifyError);
            setError(verifyError.message);
            setTimeout(() => {
              navigate('/auth');
            }, 2000);
            return;
          }
          
          console.log('Token verified successfully, redirecting...');
          // Give Supabase a moment to establish the session
          setTimeout(() => {
            navigate('/auth?mode=reset');
          }, 100);
        } else {
          navigate('/auth');
        }
      } catch (err) {
        console.error('Callback error:', err);
        setError('An error occurred processing the authentication link');
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-lg text-destructive mb-2">{error}</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </>
        ) : (
          <p className="text-lg">Processing password reset...</p>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
