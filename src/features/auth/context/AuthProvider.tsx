import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase, setAuthPersistence } from '@/lib/supabase';
import { authService } from '@/features/auth/services/authService';
import { toAuthenticatedUser } from '@/features/auth/utils/toAuthenticatedUser';
import { AuthContext } from '@/features/auth/context/authContext';
import type {
  AuthContextValue,
  AuthStatus,
  AuthenticatedUser,
  SignOutOptions,
  UserRole,
} from '@/features/auth/types/auth.types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const navigate = useNavigate();

  const applySession = useCallback((session: Session | null) => {
    if (session?.user) {
      setUser(toAuthenticatedUser(session.user));
      setStatus('authenticated');
    } else {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    authService
      .getSession()
      .then((session) => {
        if (isMounted) applySession(session);
      })
      .catch(() => {
        if (isMounted) applySession(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      applySession(session);
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [applySession, navigate]);

  const signIn = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      setAuthPersistence(rememberMe);
      const session = await authService.signInWithPassword(email, password);
      applySession(session);
    },
    [applySession],
  );

  const signOut = useCallback(
    async (options?: SignOutOptions) => {
      await authService.signOut();
      applySession(null);
      navigate('/login', { replace: true, state: options?.redirectState });
    },
    [applySession, navigate],
  );

  const requestPasswordReset = useCallback(
    (email: string) => authService.requestPasswordReset(email),
    [],
  );

  const updatePassword = useCallback(
    (newPassword: string) => authService.updatePassword(newPassword),
    [],
  );

  const resendVerificationEmail = useCallback(async () => {
    if (!user?.email) {
      throw new Error('No email address on file for this account.');
    }
    await authService.resendVerificationEmail(user.email);
  }, [user]);

  const hasRole = useCallback(
    (...roles: UserRole[]) => Boolean(user?.role && roles.includes(user.role)),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      resendVerificationEmail,
      hasRole,
    }),
    [status, user, signIn, signOut, requestPasswordReset, updatePassword, resendVerificationEmail, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
