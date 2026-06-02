import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '../types';
import {
  register as fbRegister,
  login as fbLogin,
  loginWithGoogle as fbLoginWithGoogle,
  resumeGoogleRedirect,
  signOut as fbSignOut,
  onAuth,
  isAdminUser,
  sendPhoneCode,
  confirmPhoneCode,
  sendPasswordReset,
  usersApi
} from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (input: { email: string; password: string; fullName: string; phone?: string }) => Promise<void>;
  loginWithPhone: (e164Number: string) => Promise<void>;
  confirmPhoneOtp: (code: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container';

// Firebase profiles don't carry passwordHash; consumers only read it for
// equality checks that no longer apply, so an empty string keeps the
// existing User type happy without leaking a credential.
const toUser = (uid: string, profile: Record<string, unknown> | null, fallbackEmail: string | null): User => {
  const p = profile ?? {};
  return {
    id: uid,
    email: (p.email as string) ?? fallbackEmail ?? '',
    passwordHash: '',
    fullName: (p.fullName as string) ?? (fallbackEmail?.split('@')[0] ?? 'Tresor Member'),
    phone: (p.phone as string | undefined) ?? undefined,
    role: ((p.role as 'customer' | 'admin') ?? 'customer'),
    createdAt: (p.createdAt as string) ?? new Date().toISOString(),
    defaultAddress: p.defaultAddress as User['defaultAddress']
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentUidRef = useRef<string | null>(null);

  const hydrate = useCallback(async (uid: string, email: string | null) => {
    // Profile read can fail (permission race right after sign-up, network,
    // Firestore offline). Don't let it block sign-in — fall back to a
    // minimal user synthesised from the Firebase auth identity so the
    // session is usable immediately.
    let profile: Record<string, unknown> | null = null;
    try {
      profile = (await usersApi.me()) as Record<string, unknown> | null;
    } catch (err) {
      console.warn('[auth] profile read failed; using fallback', (err as Error).message);
    }
    let admin = false;
    try {
      admin = await isAdminUser();
    } catch {
      /* token claim read failure → treat as customer */
    }
    if (currentUidRef.current !== uid) return;
    setUser(toUser(uid, profile, email));
    setIsAdmin(admin);
  }, []);

  // Capture the result of a Google sign-in redirect (mobile path) before
  // onAuth subscribes — otherwise the profile-materialise step might race.
  useEffect(() => {
    void resumeGoogleRedirect();
  }, []);

  useEffect(() => {
    const unsub = onAuth(async (fbUser) => {
      currentUidRef.current = fbUser?.uid ?? null;
      if (!fbUser) {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        await hydrate(fbUser.uid, fbUser.email);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    await fbLogin(email.trim(), password);
  }, []);

  const register = useCallback(
    async ({ email, password, fullName, phone }: { email: string; password: string; fullName: string; phone?: string }) => {
      const normalised = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalised)) throw new Error('Enter a valid email.');
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      try {
        await fbRegister({ email: normalised, password, fullName: fullName.trim(), phone: phone?.trim() });
      } catch (err) {
        // Don't let a second signup create a duplicate — point them to sign-in.
        const code = (err as { code?: string }).code;
        if (code === 'auth/email-already-in-use') {
          throw new Error('An account with this email already exists. Please sign in instead (use Google if you signed up with it).');
        }
        throw err;
      }
    },
    []
  );

  const loginWithGoogle = useCallback(async () => {
    await fbLoginWithGoogle();
  }, []);

  const loginWithPhone = useCallback(async (e164Number: string) => {
    await sendPhoneCode(e164Number, RECAPTCHA_CONTAINER_ID);
  }, []);

  const confirmPhoneOtp = useCallback(async (code: string) => {
    await confirmPhoneCode(code);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const normalised = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalised)) {
      throw new Error('Enter a valid email address.');
    }
    // Account-enumeration hygiene: swallow auth/user-not-found and pretend
    // the email was sent. The caller always shows the same "if an account
    // exists" message, so an attacker can't probe registered addresses.
    try {
      await sendPasswordReset(normalised);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') return;
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await fbSignOut();
    setUser(null);
    setIsAdmin(false);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<User>) => {
      if (!user) throw new Error('Not signed in.');
      const fsPatch: Record<string, unknown> = {};
      if (patch.fullName !== undefined) fsPatch.fullName = patch.fullName;
      if (patch.phone !== undefined) fsPatch.phone = patch.phone ?? null;
      if (patch.defaultAddress !== undefined) fsPatch.defaultAddress = patch.defaultAddress;
      await usersApi.updateMe(fsPatch);
      await hydrate(user.id, user.email);
    },
    [user, hydrate]
  );

  // Re-read the signed-in user's profile (e.g. after linking a new sign-in
  // method updates their email/phone server-side).
  const refresh = useCallback(async () => {
    if (!user) return;
    await hydrate(user.id, user.email);
  }, [user, hydrate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        login,
        loginWithGoogle,
        register,
        loginWithPhone,
        confirmPhoneOtp,
        requestPasswordReset,
        logout,
        updateProfile,
        refresh
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
