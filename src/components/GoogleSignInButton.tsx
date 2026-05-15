import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface Props {
  onDone?: () => void;
  /** Label override — defaults to "Continue with Google". */
  label?: string;
}

/**
 * Reusable Google sign-in button. Opens Firebase Auth popup; on success
 * the AuthContext mirrors the Google user into the local store and the
 * caller can navigate (e.g. → /account or → /).
 */
const GoogleSignInButton: React.FC<Props> = ({ onDone, label = 'Continue with Google' }) => {
  const { loginWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handle = async () => {
    setErr(null);
    setBusy(true);
    try {
      await loginWithGoogle();
      onDone?.();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user') {
        // User cancelled the popup — silent.
      } else if (code === 'auth/popup-blocked') {
        setErr('Browser blocked the popup. Allow popups for this site and retry.');
      } else {
        setErr((e as Error).message ?? 'Google sign-in failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-[color:var(--color-myntra-border-soft)] bg-white hover:bg-[color:var(--color-myntra-bg-soft)] rounded text-[13px] font-bold text-[color:var(--color-myntra-navy)] transition-colors disabled:opacity-60"
      >
        <GoogleGlyph />
        {busy ? 'Opening Google…' : label}
      </button>
      {err && (
        <p role="alert" className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1">
          {err}
        </p>
      )}
    </>
  );
};

const GoogleGlyph: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
);

export default GoogleSignInButton;
