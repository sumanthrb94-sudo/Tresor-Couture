import React, { useEffect, useState } from 'react';
import { Check, KeyRound, Mail, Phone, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  auth,
  getLinkedProviders,
  linkGoogleAccount,
  sendLinkPhoneCode,
  confirmLinkPhoneCode,
  linkEmailPassword,
  clearRecaptcha,
} from '../lib/firebase';

const RC_ID = 'link-recaptcha-container';
const COUNTRY_CODES = ['+91', '+1', '+44', '+61', '+971', '+65'];

/** Map the noisy Firebase link errors to one-line, actionable copy. */
function friendly(err: unknown): string {
  const code = (err as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/credential-already-in-use':
    case 'auth/account-exists-with-different-credential':
      return 'That sign-in is already linked to another account. Sign in with it instead.';
    case 'auth/email-already-in-use':
      return 'That email already belongs to another account.';
    case 'auth/provider-already-linked':
      return 'That method is already linked.';
    case 'auth/requires-recent-login':
      return 'For security, please sign out and sign in again, then link.';
    case 'auth/invalid-verification-code':
      return 'That code is incorrect. Please re-enter it.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    default:
      return (err as Error)?.message ?? 'Could not link. Please try again.';
  }
}

const LoginSecuritySection: React.FC = () => {
  const { refresh } = useAuth();
  const [providers, setProviders] = useState<string[]>(() => getLinkedProviders());
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<null | 'phone' | 'email'>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Phone sub-flow
  const [country, setCountry] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  // Email sub-flow
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');

  useEffect(() => () => clearRecaptcha(), []);

  const has = (id: string) => providers.includes(id);

  const reload = async () => {
    try { await auth.currentUser?.reload(); } catch { /* ignore */ }
    setProviders(getLinkedProviders());
    await refresh().catch(() => {});
  };

  const linkGoogle = async () => {
    setMsg(null); setBusy('google.com');
    try { await linkGoogleAccount(); await reload(); setMsg({ ok: true, text: 'Google linked.' }); }
    catch (e) { const t = friendly(e); if (t) setMsg({ ok: false, text: t }); }
    finally { setBusy(null); }
  };

  const sendCode = async () => {
    setMsg(null);
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length < 6) { setMsg({ ok: false, text: 'Enter a valid mobile number.' }); return; }
    setBusy('phone');
    try { await sendLinkPhoneCode(`${country}${digits}`, RC_ID); setOtpStep('code'); }
    catch (e) { const t = friendly(e); if (t) setMsg({ ok: false, text: t }); }
    finally { setBusy(null); }
  };

  const confirmCode = async () => {
    setMsg(null);
    if (!/^\d{6}$/.test(code.trim())) { setMsg({ ok: false, text: 'Enter the 6-digit code.' }); return; }
    setBusy('phone');
    try {
      await confirmLinkPhoneCode(code.trim());
      await reload();
      setOpen(null); setOtpStep('phone'); setPhone(''); setCode('');
      setMsg({ ok: true, text: 'Phone number linked.' });
    } catch (e) { const t = friendly(e); if (t) setMsg({ ok: false, text: t }); }
    finally { setBusy(null); }
  };

  const linkEmail = async () => {
    setMsg(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setMsg({ ok: false, text: 'Enter a valid email.' }); return; }
    if (pwd.length < 6) { setMsg({ ok: false, text: 'Password must be at least 6 characters.' }); return; }
    setBusy('password');
    try {
      await linkEmailPassword(email.trim(), pwd);
      await reload();
      setOpen(null); setEmail(''); setPwd('');
      setMsg({ ok: true, text: 'Email & password linked.' });
    } catch (e) { const t = friendly(e); if (t) setMsg({ ok: false, text: t }); }
    finally { setBusy(null); }
  };

  const Row: React.FC<{ id: string; label: string; icon: React.ComponentType<{ className?: string }>; onAdd?: () => void }> = ({ id, label, icon: Icon, onAdd }) => (
    <div className="flex items-center justify-between py-3 border-b border-[color:var(--color-myntra-border-soft)] last:border-b-0">
      <span className="flex items-center gap-2.5 text-[14px] text-[color:var(--color-myntra-navy)]">
        <Icon className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> {label}
      </span>
      {has(id) ? (
        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[color:var(--color-myntra-green)]">
          <Check className="w-4 h-4" /> Linked
        </span>
      ) : onAdd ? (
        <button
          onClick={onAdd}
          disabled={busy === id}
          className="inline-flex items-center gap-1 text-[12px] font-bold text-[color:var(--color-myntra-pink)] disabled:opacity-60"
        >
          <Plus className="w-3.5 h-3.5" /> {busy === id ? 'Linking…' : 'Add'}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-5 md:p-6 mt-4">
      <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-1">
        Login &amp; Security
      </h3>
      <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mb-3 leading-relaxed">
        Link more ways to sign in so you always reach the same account — no duplicates.
      </p>

      <Row id="password" label="Email &amp; Password" icon={Mail} onAdd={() => { setOpen(open === 'email' ? null : 'email'); setMsg(null); }} />
      <Row id="google.com" label="Google" icon={Mail} onAdd={linkGoogle} />
      <Row id="phone" label="Phone (OTP)" icon={Phone} onAdd={() => { setOpen(open === 'phone' ? null : 'phone'); setOtpStep('phone'); setMsg(null); }} />

      {open === 'email' && !has('password') && (
        <div className="mt-3 space-y-2 border-t border-[color:var(--color-myntra-border-soft)] pt-3">
          <input className="input-box" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="input-box" type="password" placeholder="Create a password (min 6)" value={pwd} onChange={e => setPwd(e.target.value)} />
          <button onClick={linkEmail} disabled={busy === 'password'} className="btn-primary w-full">
            {busy === 'password' ? 'Linking…' : 'Link email & password'}
          </button>
        </div>
      )}

      {open === 'phone' && !has('phone') && (
        <div className="mt-3 space-y-2 border-t border-[color:var(--color-myntra-border-soft)] pt-3">
          {otpStep === 'phone' ? (
            <>
              <div className="flex gap-2">
                <select value={country} onChange={e => setCountry(e.target.value)} className="input-box w-[90px] shrink-0" aria-label="Country code">
                  {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className="input-box flex-1" type="tel" inputMode="numeric" placeholder="Mobile number" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <button onClick={sendCode} disabled={busy === 'phone'} className="btn-primary w-full">
                {busy === 'phone' ? 'Sending…' : 'Send code'}
              </button>
            </>
          ) : (
            <>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)]" />
                <input className="input-box pl-9 tracking-[0.3em]" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={e => setCode(e.target.value.replace(/[^\d]/g, ''))} />
              </div>
              <button onClick={confirmCode} disabled={busy === 'phone'} className="btn-primary w-full">
                {busy === 'phone' ? 'Verifying…' : 'Verify & link'}
              </button>
            </>
          )}
        </div>
      )}

      {msg && (
        <p className={`text-[12px] mt-3 font-semibold ${msg.ok ? 'text-[color:var(--color-myntra-green)]' : 'text-[color:var(--color-myntra-pink)]'}`}>
          {msg.text}
        </p>
      )}

      {/* reCAPTCHA host for phone linking. */}
      <div id={RC_ID} />
    </div>
  );
};

export default LoginSecuritySection;
