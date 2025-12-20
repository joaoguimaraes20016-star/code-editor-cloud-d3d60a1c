import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface LastAuthError {
  name?: string;
  message?: string;
  code?: string | number;
  isFailedToFetch?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, creatorCode?: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  lastAuthError: LastAuthError | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function logAuthError(
  context: string,
  error: any,
  extra?: Record<string, unknown>,
  setLastAuthError?: (value: LastAuthError | null) => void
) {
  const message = error?.message || String(error);
  const name = error?.name;
  const code = error?.code ?? error?.status ?? error?.statusCode;
  const isFailedToFetch = typeof message === 'string' && message.toLowerCase().includes('failed to fetch');

  let origin = 'unknown';
  if (typeof window !== 'undefined') {
    origin = window.location.origin;
  }

  const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  let supabaseHost: string | null = null;
  if (rawUrl) {
    try {
      supabaseHost = new URL(rawUrl).hostname;
    } catch {
      supabaseHost = 'invalid-url';
    }
  }

  // This never logs credentials; it only logs high-level context.
  console.error('[Auth][Supabase] Operation failed', {
    context,
    name,
    message,
    code,
    isFailedToFetch,
    origin,
    supabaseHost,
    ...extra,
  });

  if (setLastAuthError) {
    setLastAuthError({ name, message, code, isFailedToFetch });
  }

  if (import.meta.env.DEV && isFailedToFetch) {
    console.error(
      '[Auth][Supabase][dev] Request appears to have failed before reaching Supabase ("Failed to fetch").',
      'Check that you are using the forwarded *.app.github.dev URL for this Codespace and that VITE_SUPABASE_URL points to the correct project.'
    );
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastAuthError, setLastAuthError] = useState<LastAuthError | null>(null);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      }
    );

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (error) {
          logAuthError('getSession', error, undefined, setLastAuthError);
          setSession(null);
          setUser(null);
        } else {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
          setLastAuthError(null);
        }
      } catch (err: any) {
        if (!isMounted) return;
        logAuthError('getSession', err, { thrown: true }, setLastAuthError);
        setSession(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logAuthError('signIn', error, undefined, setLastAuthError);
      }

      if (!error) {
        setLastAuthError(null);
      }

      return { error };
    } catch (err: any) {
      logAuthError('signIn', err, { thrown: true }, setLastAuthError);
      return {
        error: {
          message:
            'Could not reach the auth server. Check your Codespaces URL and Supabase environment variables, then try again.',
        },
      };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, creatorCode?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Check if creator code is provided and valid
    if (creatorCode) {
      const { data: codeData, error: codeError } = await supabase
        .from('creator_codes')
        .select('code, is_active')
        .eq('code', creatorCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();
      
      if (codeError || !codeData) {
        return { data: null, error: { message: 'Invalid creator code' } };
      }
    }
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            creator_code: creatorCode || null,
          },
        },
      });

      if (error) {
        logAuthError('signUp', error, undefined, setLastAuthError);
      }

      if (!error) {
        setLastAuthError(null);
      }

      return { data, error };
    } catch (err: any) {
      logAuthError('signUp', err, { thrown: true }, setLastAuthError);
      return {
        data: null,
        error: {
          message:
            'Could not reach the auth server to create your account. Check your connection and Supabase settings, then try again.',
        },
      };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if the API call fails, force local logout
    } finally {
      // Always clear local session state regardless of API result
      setSession(null);
      setUser(null);
      // Clear any stale tokens from localStorage
      localStorage.removeItem('sb-inbvluddkutyfhsxfqco-auth-token');
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-password-reset', {
        body: { email },
      });

      if (error) {
        logAuthError('resetPassword', error, undefined, setLastAuthError);
      }

      if (!error) {
        setLastAuthError(null);
      }

      return { error };
    } catch (err: any) {
      logAuthError('resetPassword', err, { thrown: true }, setLastAuthError);
      return {
        error: {
          message:
            'Could not reach the password reset endpoint. Check your Codespaces URL and Supabase function configuration.',
        },
      };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signUp, signOut, resetPassword, lastAuthError }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
