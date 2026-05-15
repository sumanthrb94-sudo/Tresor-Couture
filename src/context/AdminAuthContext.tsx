import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Minimal client-side gate for the /admin section. Not real security — the
 * brand kit assets are public under /branding anyway. The gate just hides the
 * admin tools from shoppers and adds a single chokepoint for future hardening.
 *
 * Default passcode: "tresor-atelier". Override at build time with
 *   VITE_ADMIN_PASSCODE=...
 * (see .env.example) and the build will bake the new value in.
 */
// Vite injects env vars into import.meta.env at build time. Cast to any to
// avoid pulling in vite/client types in a project without a vite-env.d.ts.
const PASSCODE: string =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_ADMIN_PASSCODE) ||
  'tresor-atelier';
const STORAGE_KEY = 'tc.admin.unlocked';

interface AdminAuthValue {
  unlocked: boolean;
  unlock: (code: string) => boolean;
  lock: () => void;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (unlocked) window.sessionStorage.setItem(STORAGE_KEY, '1');
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sessionStorage may be unavailable (SSR / privacy mode) */
    }
  }, [unlocked]);

  const unlock = useCallback((code: string) => {
    const ok = code.trim().toLowerCase() === PASSCODE.toLowerCase();
    if (ok) setUnlocked(true);
    return ok;
  }, []);

  const lock = useCallback(() => setUnlocked(false), []);

  const value = useMemo<AdminAuthValue>(() => ({ unlocked, unlock, lock }), [unlocked, unlock, lock]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = (): AdminAuthValue => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
};
