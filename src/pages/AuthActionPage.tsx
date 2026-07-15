import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import {
  verifyResetCode,
  completePasswordReset,
  applyAuthActionCode,
  inspectActionCode,
} from '../lib/firebase';

interface Props {
  mode: string;
  oobCode: string;
  continueUrl?: string;
}

type ResetPhase = 'verifying' | 'ready' | 'submitting' | 'done' | 'error';
type VerifyPhase = 'applying' | 'done' | 'error';

const ALLOWED_MODES = new Set(['resetPassword', 'verifyEmail', 'recoverEmail']);

/**
 * Branded handler for Firebase email action links — the page the user
 * lands on after clicking "Reset my password" / "Confirm my email" in a
 * Firebase Auth email. Replaces the unbranded firebaseapp.com page.
 *
 * Configured in Firebase Console → Authentication → Templates →
 * "Customize action URL" → set to https://<your-domain>/auth/action.
 *
 * Supported modes:
 *   - resetPassword   → verify + set new password + redirect to /login
 *   - verifyEmail     → apply the code, show success
 *   - recoverEmail    → confirm reversion + apply
 */
const AuthActionPage: React.FC<Props> = ({ mode, oobCode, continueUrl }) => {
  const { navigate } = useRouter();

  // -------- Password reset state --------
  const [resetPhase, setResetPhase] = useState<ResetPhase>('verifying');
  const [resetEmail, setResetEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // -------- Email verify / recover state --------
  const [verifyPhase, setVerifyPhase] = useState<VerifyPhase>('applying');
  const [verifyMessage, setVerifyMessage] = useState<string>('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [recoverOriginalEmail, setRecoverOriginalEmail] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'resetPassword') {
      let cancelled = false;
      (async () => {
        try {
          const email = await verifyResetCode(oobCode);
          if (cancelled) return;
          setResetEmail(email);
          setResetPhase('ready');
        } catch (err) {
          if (cancelled) return;
          setResetError(humaniseAuthError(err));
          setResetPhase('error');
        }
      })();
      return () => { cancelled = true; };
    }

    if (mode === 'verifyEmail') {
      let cancelled = false;
      (async () => {
        try {
          await applyAuthActionCode(oobCode);
          if (cancelled) return;
          setVerifyMessage('Your email is confirmed. Welcome to the archive.');
          setVerifyPhase('done');
        } catch (err) {
          if (cancelled) return;
          setVerifyError(humaniseAuthError(err));
          setVerifyPhase('error');
        }
      })();
      return () => { cancelled = true; };
    }

    if (mode === 'recoverEmail') {
      let cancelled = false;
      (async () => {
        try {
          const info = await inspectActionCode(oobCode);
          if (cancelled) return;
          const previous = info.data.email ?? null;
          setRecoverOriginalEmail(previous);
          await applyAuthActionCode(oobCode);
          if (cancelled) return;
          setVerifyMessage(
            previous
              ? `Your email has been reverted to ${previous}.`
              : 'Your email has been reverted.'
          );
          setVerifyPhase('done');
        } catch (err) {
          if (cancelled) return;
          setVerifyError(humaniseAuthError(err));
          setVerifyPhase('error');
        }
      })();
      return () => { cancelled = true; };
    }
  }, [mode, oobCode]);

  const handleResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetError(null);
    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || (!/\d/.test(newPassword) && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword))) {
      setResetError('Password must include a letter and a number or symbol.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('The two passwords do not match.');
      return;
    }
    setResetPhase('submitting');
    try {
      await completePasswordReset(oobCode, newPassword);
      setResetPhase('done');
    } catch (err) {
      setResetError(humaniseAuthError(err));
      setResetPhase('ready');
    }
  };

  const goToLogin = () => {
    // Open-redirect guard: `continueUrl` comes straight from the action link's
    // query string, so only follow it when it resolves to OUR origin. An
    // attacker-supplied external host (…?continueUrl=https://evil.com) must
    // never be navigated to — fall back to the in-app login instead.
    if (continueUrl) {
      try {
        const dest = new URL(continueUrl, window.location.origin);
        if (dest.origin === window.location.origin) {
          window.location.href = dest.href;
          return;
        }
      } catch {
        /* malformed URL → fall through to in-app login */
      }
    }
    navigate({ name: 'login' });
  };

  return (
    <main className="pt-[100px] md:pt-[112px] pb-12 md:pb-16 bg-[color:var(--color-myntra-bg-soft)] min-h-screen">
      <div className="max-w-[560px] mx-auto px-4 md:px-8">
        <p className="section-eyebrow mb-2">Account Recovery</p>
        <h1 className="text-xl md:text-2xl font-extrabold mb-4 text-[color:var(--color-myntra-navy)]">
          {mode === 'resetPassword' ? 'Choose a new password' :
           mode === 'verifyEmail'   ? 'Confirming your email' :
           mode === 'recoverEmail'  ? 'Restoring your email'  :
           'Unknown action'}
        </h1>

        <section className="bg-white border border-[color:var(--color-myntra-border-soft)] p-6 md:p-8">
          {/* ─────────────── PASSWORD RESET ─────────────── */}
          {mode === 'resetPassword' && (
            <>
              {resetPhase === 'verifying' && (
                <CenterStatus icon={<KeyRound className="w-6 h-6 text-[color:var(--color-myntra-ink-mute)]" />}>
                  Verifying your reset link…
                </CenterStatus>
              )}

              {resetPhase === 'error' && (
                <ErrorPanel
                  title="This reset link is no longer valid"
                  message={resetError ?? 'The link has expired or has already been used.'}
                  primaryLabel="Request a new reset link"
                  onPrimary={() => navigate({ name: 'login' })}
                />
              )}

              {(resetPhase === 'ready' || resetPhase === 'submitting') && (
                <form onSubmit={handleResetSubmit} noValidate className="space-y-4">
                  <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
                    Setting a new password for <span className="font-bold text-[color:var(--color-myntra-navy)]">{resetEmail}</span>.
                  </p>

                  <div>
                    <label
                      htmlFor="new-password"
                      className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        autoFocus
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="input-box pl-9 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-pink)]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
                      <input
                        id="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter the password"
                        className="input-box pl-9"
                      />
                    </div>
                  </div>

                  {resetError && (
                    <p
                      role="alert"
                      className="text-[13px] font-semibold text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] px-3 py-2 rounded"
                    >
                      {resetError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={resetPhase === 'submitting'}
                    className="btn-primary w-full"
                  >
                    {resetPhase === 'submitting' ? 'Saving…' : 'Save new password'}
                  </button>
                </form>
              )}

              {resetPhase === 'done' && (
                <SuccessPanel
                  title="Your password is updated"
                  message="You can now sign in with your new password."
                  primaryLabel="Continue to sign in"
                  onPrimary={goToLogin}
                />
              )}
            </>
          )}

          {/* ─────────────── EMAIL VERIFY ─────────────── */}
          {mode === 'verifyEmail' && (
            <>
              {verifyPhase === 'applying' && (
                <CenterStatus icon={<ShieldCheck className="w-6 h-6 text-[color:var(--color-myntra-ink-mute)]" />}>
                  Confirming your email…
                </CenterStatus>
              )}
              {verifyPhase === 'error' && (
                <ErrorPanel
                  title="We could not confirm this link"
                  message={verifyError ?? 'The link has expired or has already been used.'}
                  primaryLabel="Continue to sign in"
                  onPrimary={goToLogin}
                />
              )}
              {verifyPhase === 'done' && (
                <SuccessPanel
                  title="Email confirmed"
                  message={verifyMessage}
                  primaryLabel="Continue to sign in"
                  onPrimary={goToLogin}
                />
              )}
            </>
          )}

          {/* ─────────────── EMAIL RECOVER ─────────────── */}
          {mode === 'recoverEmail' && (
            <>
              {verifyPhase === 'applying' && (
                <CenterStatus icon={<ShieldCheck className="w-6 h-6 text-[color:var(--color-myntra-ink-mute)]" />}>
                  Reverting your email…
                </CenterStatus>
              )}
              {verifyPhase === 'error' && (
                <ErrorPanel
                  title="We could not revert this email"
                  message={verifyError ?? 'The link has expired or has already been used.'}
                  primaryLabel="Continue to sign in"
                  onPrimary={goToLogin}
                />
              )}
              {verifyPhase === 'done' && (
                <SuccessPanel
                  title="Email restored"
                  message={verifyMessage}
                  primaryLabel="Continue to sign in"
                  onPrimary={goToLogin}
                  hint={recoverOriginalEmail ? 'You should also reset your password as a precaution.' : undefined}
                />
              )}
            </>
          )}

          {/* ─────────────── UNKNOWN MODE ─────────────── */}
          {mode !== 'resetPassword' && mode !== 'verifyEmail' && mode !== 'recoverEmail' && (
            <ErrorPanel
              title="Unknown account action"
              message="This link uses an action we do not recognise. Please request a new link from the sign-in page."
              primaryLabel="Continue to sign in"
              onPrimary={goToLogin}
            />
          )}
        </section>
      </div>
    </main>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Small presentation helpers
// ──────────────────────────────────────────────────────────────────────────

const CenterStatus: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="py-6 flex flex-col items-center text-center gap-3">
    {icon}
    <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)]">{children}</p>
  </div>
);

const SuccessPanel: React.FC<{
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  hint?: string;
}> = ({ title, message, primaryLabel, onPrimary, hint }) => (
  <div className="text-center py-2 space-y-4">
    <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--color-myntra-green)]" />
    <h2 className="text-[16px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)]">{title}</h2>
    <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] leading-relaxed">{message}</p>
    {hint && <p className="text-[12px] text-[color:var(--color-myntra-ink-mute)]">{hint}</p>}
    <button onClick={onPrimary} className="btn-primary w-full">{primaryLabel}</button>
  </div>
);

const ErrorPanel: React.FC<{
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
}> = ({ title, message, primaryLabel, onPrimary }) => (
  <div className="text-center py-2 space-y-4">
    <ShieldAlert className="w-10 h-10 mx-auto text-[color:var(--color-myntra-pink)]" />
    <h2 className="text-[16px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)]">{title}</h2>
    <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] leading-relaxed">{message}</p>
    <button onClick={onPrimary} className="btn-primary w-full">{primaryLabel}</button>
  </div>
);

// Map Firebase auth/* error codes to short, voice-appropriate copy.
function humaniseAuthError(err: unknown): string {
  const code = (err as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/expired-action-code':
      return 'This link has expired. Please request a fresh one from the sign-in page.';
    case 'auth/invalid-action-code':
      return 'This link is no longer valid — it may already have been used, or the request was cancelled.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please reach out to us for help.';
    case 'auth/user-not-found':
      return 'We could not find an account for this link.';
    case 'auth/weak-password':
      return 'Please choose a stronger password (at least 6 characters).';
    default:
      return (err as Error)?.message ?? 'Something went wrong. Please try again.';
  }
}

export default AuthActionPage;
