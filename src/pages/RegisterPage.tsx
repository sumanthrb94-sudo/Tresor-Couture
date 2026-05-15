import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Phone, Sparkles, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import PhoneOtpForm from '../components/PhoneOtpForm';

type Mode = 'email' | 'phone';

interface FieldErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,}$/;

const RegisterPage: React.FC = () => {
  const { register, user, loading } = useAuth();
  const { navigate, hrefFor } = useRouter();

  const [mode, setMode] = useState<Mode>('email');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ name: 'account' });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!submitError) return;
    const id = window.setTimeout(() => setSubmitError(null), 5000);
    return () => window.clearTimeout(id);
  }, [submitError]);

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (fullName.trim().length < 2) next.fullName = 'Enter your full name (min 2 characters).';
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (phone.trim() && !PHONE_RE.test(phone.trim())) next.phone = 'Enter a valid phone number.';
    if (password.length < 6) next.password = 'Password must be at least 6 characters.';
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password
      });
      navigate({ name: 'account' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create your account.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pt-[100px] pb-12 md:pb-16 bg-[color:var(--color-myntra-bg-soft)] min-h-screen">
      <div className="max-w-[480px] mx-auto px-4 md:px-0">
        <p className="section-eyebrow mb-2">Join Trésor</p>
        <h1 className="text-xl md:text-2xl font-extrabold mb-4 text-[color:var(--color-myntra-navy)]">
          Create your atelier account
        </h1>

        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-6 md:p-8">
          <div className="flex items-start gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-[color:var(--color-myntra-pink)] mt-0.5 shrink-0" />
            <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] leading-relaxed">
              Save fabrics to your private wishlist, track every order, and enjoy curated
              drops reserved for our members.
            </p>
          </div>

          <div role="tablist" aria-label="Sign-up method" className="inline-flex p-1 bg-[color:var(--color-myntra-bg-soft)] border border-[color:var(--color-myntra-border-soft)] rounded mb-5">
            {(['email', 'phone'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setSubmitError(null); }}
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
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] leading-relaxed">
                Verify your number to create an account instantly — no password required.
              </p>
              <PhoneOtpForm onDone={() => navigate({ name: 'account' })} verifyLabel="Verify & Create Account" />

              <div className="flex items-center gap-3 my-1">
                <span className="flex-1 h-px bg-[color:var(--color-myntra-border-soft)]" />
                <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-[color:var(--color-myntra-ink-mute)]">or</span>
                <span className="flex-1 h-px bg-[color:var(--color-myntra-border-soft)]" />
              </div>

              <GoogleSignInButton onDone={() => navigate({ name: 'account' })} label="Sign up with Google" />
            </div>
          ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="register-name"
                className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Aanya Mehra"
                  className="input-box pl-9"
                />
              </div>
              {errors.fullName && (
                <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">
                  {errors.fullName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-box pl-9"
                />
              </div>
              {errors.email && (
                <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="register-phone"
                className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
              >
                Phone <span className="text-[color:var(--color-myntra-ink-mute)] font-medium normal-case">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
                <input
                  id="register-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="input-box pl-9"
                />
              </div>
              {errors.phone && (
                <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">
                  {errors.phone}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
              {errors.password && (
                <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">
                  {errors.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="register-confirm"
                className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
                <input
                  id="register-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="input-box pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(s => !s)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-pink)]"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {submitError && (
              <p
                role="alert"
                className="text-[13px] font-semibold text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] px-3 py-2 rounded"
              >
                {submitError}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Creating account…' : 'Create Account'}
            </button>

            <div className="flex items-center gap-3 my-1">
              <span className="flex-1 h-px bg-[color:var(--color-myntra-border-soft)]" />
              <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-[color:var(--color-myntra-ink-mute)]">or</span>
              <span className="flex-1 h-px bg-[color:var(--color-myntra-border-soft)]" />
            </div>

            <GoogleSignInButton onDone={() => navigate({ name: 'account' })} label="Sign up with Google" />

            <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] leading-relaxed">
              By creating an account, you agree to Trésor Couture&apos;s{' '}
              <span className="font-semibold text-[color:var(--color-myntra-ink-soft)]">Terms of Use</span> and{' '}
              <span className="font-semibold text-[color:var(--color-myntra-ink-soft)]">Privacy Policy</span>.
            </p>
          </form>
          )}

          <hr className="my-5 border-[color:var(--color-myntra-border-soft)]" />

          <p className="text-[13px] text-center text-[color:var(--color-myntra-ink-soft)]">
            Already have an account?{' '}
            <a
              href={hrefFor({ name: 'login' })}
              onClick={e => {
                e.preventDefault();
                navigate({ name: 'login' });
              }}
              className="font-bold text-[color:var(--color-myntra-pink)] hover:underline"
            >
              Login
            </a>
          </p>
        </div>
      </div>
    </main>
  );
};

export default RegisterPage;
