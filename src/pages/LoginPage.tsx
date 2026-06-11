import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import PhoneOtpForm from '../components/PhoneOtpForm';

type Mode = 'email' | 'phone';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const LoginPage: React.FC = () => {
  const { login, requestPasswordReset, user, loading } = useAuth();
  const { navigate, hrefFor } = useRouter();
  const [mode, setMode] = useState<Mode>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  // Google popup + profile-hydrate is in flight (set by GoogleSignInButton).
  const [googleBusy, setGoogleBusy] = useState(false);

  // Show a full-screen loader instead of flashing the login form when: auth
  // state is still resolving on first paint, a sign-in is in flight, or we're
  // already signed in and about to be routed away.
  const authInFlight = loading || !!user || submitting || googleBusy;

  // If the user signs in via Google redirect (mobile), they bounce back to
  // this page already authed — route them to /account so they don't stare
  // at the login form.
  useEffect(() => {
    if (!loading && user) navigate({ name: 'home' });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(id);
  }, [error]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      const isAdminLogin = email.trim().toLowerCase() === 'admin@tresor.test';
      navigate(isAdminLogin ? { name: 'admin' } : { name: 'home' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const openForgot = () => {
    setForgotEmail(email.trim());
    setForgotMsg(null);
    setForgotOpen(true);
  };

  const handleForgotSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForgotMsg(null);
    setForgotBusy(true);
    try {
      await requestPasswordReset(forgotEmail);
      // Generic copy — never reveals whether the email is registered.
      setForgotMsg(
        `If an account exists for ${forgotEmail.trim()}, a reset link is on its way. Please also check your spam folder.`
      );
    } catch (err) {
      setForgotMsg((err as Error).message ?? 'Could not send reset link. Please try again.');
    } finally {
      setForgotBusy(false);
    }
  };

  return (
    <main className="pt-[100px] md:pt-[112px] pb-12 md:pb-16 bg-[color:var(--color-myntra-bg-soft)] min-h-screen">
      {authInFlight && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-[color:var(--color-myntra-bg-soft)]/95 backdrop-blur-sm"
        >
          <div className="w-9 h-9 border-2 border-[color:var(--color-myntra-pink)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-navy)]">
            {user ? 'Signing you in…' : googleBusy || submitting ? 'Signing you in…' : 'Loading…'}
          </p>
        </div>
      )}
      <div className="max-w-[960px] mx-auto px-4 md:px-8 lg:px-10">
        <p className="section-eyebrow mb-2">Members of Tresor</p>
        <h1 className="text-xl md:text-2xl font-extrabold mb-4 text-[color:var(--color-myntra-navy)]">
          Sign in to your atelier
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 bg-white border border-[color:var(--color-myntra-border-soft)]">
          {/* Left: Login form */}
          <section className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-[color:var(--color-myntra-border-soft)]">
            <h2 className="text-[18px] font-extrabold uppercase tracking-wider mb-1 text-[color:var(--color-myntra-navy)]">
              Welcome back
            </h2>
            <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-4">
              Pick up where you left off — saved bolts, orders, and your private wishlist.
            </p>

            <div role="tablist" aria-label="Sign-in method" className="inline-flex p-1 bg-[color:var(--color-myntra-bg-soft)] border border-[color:var(--color-myntra-border-soft)] rounded mb-5">
              {(['email', 'phone'] as Mode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={
                    'px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider rounded transition-colors ' +
                    (mode === m
                      ? 'bg-white text-[color:var(--color-myntra-navy)] shadow-sm'
                      : 'text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-navy)]')
                  }
                >
                  {m === 'email' ? 'Email' : 'Phone'}
                </button>
              ))}
            </div>

            {mode === 'phone' ? (
              <div className="space-y-4">
                <PhoneOtpForm onDone={() => navigate({ name: 'home' })} verifyLabel="Verify & Sign in" />

                <div className="flex items-center gap-3 my-1">
                  <span className="flex-1 h-px bg-[color:var(--color-myntra-border-soft)]" />
                  <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-[color:var(--color-myntra-ink-mute)]">or</span>
                  <span className="flex-1 h-px bg-[color:var(--color-myntra-border-soft)]" />
                </div>

                <GoogleSignInButton onDone={() => navigate({ name: 'home' })} onBusyChange={setGoogleBusy} />

                <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] leading-relaxed">
                  By continuing, you agree to Tresor Couture&apos;s{' '}
                  <span className="font-semibold text-[color:var(--color-myntra-ink-soft)]">Terms of Use</span> and{' '}
                  <span className="font-semibold text-[color:var(--color-myntra-ink-soft)]">Privacy Policy</span>.
                </p>
              </div>
            ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input-box pl-9"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={openForgot}
                    className="text-[12px] font-bold text-[color:var(--color-myntra-pink)] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Your password"
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

              {error && (
                <p
                  role="alert"
                  className="text-[13px] font-semibold text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] px-3 py-2 rounded"
                >
                  {error}
                </p>
              )}

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Signing in…' : 'Login'}
              </button>

              <div className="flex items-center gap-3 my-1">
                <span className="flex-1 h-px bg-[color:var(--color-myntra-border-soft)]" />
                <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-[color:var(--color-myntra-ink-mute)]">or</span>
                <span className="flex-1 h-px bg-[color:var(--color-myntra-border-soft)]" />
              </div>

              <GoogleSignInButton onDone={() => navigate({ name: 'home' })} onBusyChange={setGoogleBusy} />

              <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] leading-relaxed">
                By continuing, you agree to Tresor Couture&apos;s{' '}
                <span className="font-semibold text-[color:var(--color-myntra-ink-soft)]">Terms of Use</span> and{' '}
                <span className="font-semibold text-[color:var(--color-myntra-ink-soft)]">Privacy Policy</span>.
              </p>
            </form>
            )}
          </section>

          {/* Right: New to Tresor */}
          <aside className="p-6 md:p-8 bg-[color:var(--color-myntra-bg-sale)] flex flex-col">
            <Sparkles className="w-6 h-6 text-[color:var(--color-myntra-pink)] mb-3" />
            <h2 className="text-[18px] font-extrabold uppercase tracking-wider mb-2 text-[color:var(--color-myntra-navy)]">
              New to Tresor?
            </h2>
            <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-6 leading-relaxed">
              Create an account to unlock curated drops, faster checkout, complimentary
              swatches on your first order, and early access to bridal collections.
            </p>

            <ul className="space-y-2.5 text-[13px] text-[color:var(--color-myntra-ink)] mb-6">
              <li className="flex items-start gap-2">
                <span className="text-[color:var(--color-myntra-pink)] font-extrabold leading-5">·</span>
                Save fabrics to your private wishlist
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[color:var(--color-myntra-pink)] font-extrabold leading-5">·</span>
                Track orders and download invoices
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[color:var(--color-myntra-pink)] font-extrabold leading-5">·</span>
                Pre-fill addresses for one-tap checkout
              </li>
            </ul>

            <a
              href={hrefFor({ name: 'register' })}
              onClick={e => {
                e.preventDefault();
                navigate({ name: 'register' });
              }}
              className="btn-outline text-center"
            >
              Create Account
            </a>
          </aside>
        </div>

        {forgotOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={e => { if (e.target === e.currentTarget) setForgotOpen(false); }}
          >
            <div className="bg-white border border-[color:var(--color-myntra-border-soft)] w-full max-w-[440px] p-6 md:p-7">
              <h3 id="forgot-title" className="text-[16px] font-extrabold uppercase tracking-wider mb-1 text-[color:var(--color-myntra-navy)]">
                Reset your password
              </h3>
              <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-4">
                Enter the email on your account. If it is registered, we will send a link to choose a new password.
              </p>

              <form onSubmit={handleForgotSubmit} noValidate className="space-y-3">
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
                  <input
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input-box pl-9"
                  />
                </div>

                {forgotMsg && (
                  <p
                    role="status"
                    className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)] bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] px-3 py-2 rounded"
                  >
                    {forgotMsg}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="btn-outline flex-1"
                  >
                    Close
                  </button>
                  <button type="submit" disabled={forgotBusy} className="btn-primary flex-1">
                    {forgotBusy ? 'Sending…' : 'Send reset link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Demo creds tip */}
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] mt-4 px-4 py-3 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[color:var(--color-myntra-green)] shrink-0 mt-0.5" />
          <div className="text-[12px] text-[color:var(--color-myntra-ink-soft)] leading-relaxed">
            <p className="font-bold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-1">
              Demo credentials
            </p>
            <p>
              Sign in with{' '}
              <span className="font-bold text-[color:var(--color-myntra-navy)]">admin@tresor.test</span>{' '}/{' '}
              <span className="font-bold text-[color:var(--color-myntra-navy)]">tresor-admin</span> to
              explore the admin console. Customers may register a fresh account below.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
