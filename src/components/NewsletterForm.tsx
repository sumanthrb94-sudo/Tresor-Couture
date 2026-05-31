import React, { useState } from 'react';
import { Mail, Check } from 'lucide-react';
import { subscribersApi } from '../lib/firebase';

// Same shape used across the app's address/checkout validation.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Props {
  /** Where this opt-in came from, stored on the subscriber for attribution. */
  source?: string;
  className?: string;
  /** Compact = single-row email + button (no WhatsApp field), for tight slots. */
  compact?: boolean;
}

/**
 * Provider-agnostic marketing capture. Writes opt-ins straight to the
 * Firestore `subscribers` collection so we own the audience from day one —
 * even before an ESP (MailerLite) or WhatsApp BSP is connected. A later
 * sync job (or the admin export) pushes these into the marketing platform.
 *
 * Capture must never fail the visitor: any write error is swallowed and the
 * success state is still shown (the lead is far more valuable than a perfect
 * confirmation). Duplicates are de-duped downstream at sync time.
 */
const NewsletterForm: React.FC<Props> = ({ source = 'web', className = '', compact = false }) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setState('error');
      setMsg('Enter a valid email address.');
      return;
    }
    setState('busy');
    setMsg(null);
    try {
      await subscribersApi.add({ email, phone: phone || undefined, source });
    } catch {
      // Best-effort: never block the visitor on a Firestore hiccup.
    }
    setState('done');
    setEmail('');
    setPhone('');
  };

  if (state === 'done') {
    return (
      <p className={`inline-flex items-center gap-2 text-[13px] font-semibold text-[color:var(--color-myntra-green)] ${className}`}>
        <Check className="w-4 h-4" aria-hidden /> You&apos;re on the list. Watch your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={className} noValidate>
      <div className={compact ? 'flex gap-2' : 'flex flex-col sm:flex-row gap-2'}>
        <div className="relative flex-1">
          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)]" aria-hidden />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
            placeholder="Your email"
            aria-label="Email address"
            className="input-box pl-9 w-full"
          />
        </div>
        {!compact && (
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="WhatsApp number (optional)"
            aria-label="WhatsApp number (optional)"
            className="input-box sm:w-56"
          />
        )}
        <button type="submit" disabled={state === 'busy'} className="btn-primary whitespace-nowrap disabled:opacity-60">
          {state === 'busy' ? 'Joining…' : 'Notify me'}
        </button>
      </div>
      {msg && <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1.5 font-semibold">{msg}</p>}
      {!msg && (
        <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-1.5">
          Launch news, private previews, and delivery updates. No spam.
        </p>
      )}
    </form>
  );
};

export default NewsletterForm;
