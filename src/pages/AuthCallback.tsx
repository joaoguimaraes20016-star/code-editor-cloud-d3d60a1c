import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      const type = params.get('type');
      
      console.log('=== Auth Callback Triggered ===');
      console.log('URL:', window.location.href);
      console.log('Params:', { tokenHash: !!tokenHash, type });
      
      if (type === 'recovery' && tokenHash) {
        console.log('Processing recovery token...');
        
        // The session is automatically established by clicking the link
        // We just need to wait a moment for Supabase to process it
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          console.log('Session after recovery:', session?.user?.email);
          
          if (session) {
            // Redirect with a flag to show the password reset form
            navigate('/auth?reset=true');
          } else {
            console.error('No session found after recovery');
            navigate('/auth');
          }
        }, 500);
      } else {
        console.log('No recovery type, redirecting to auth');
        navigate('/auth');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-lg">Processing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
