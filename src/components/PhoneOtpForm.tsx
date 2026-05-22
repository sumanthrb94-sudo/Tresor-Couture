import React, { useEffect, useState } from 'react';
import { KeyRound, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clearRecaptcha } from '../lib/firebase';

interface Props {
  onDone?: () => void;
  /** CTA label shown on the OTP verify button — defaults to "Verify & Continue". */
  verifyLabel?: string;
}

// Curated short list — full ITU list would crowd the dropdown without
// adding signal for the markets the storefront ships to today.
const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: '+91', label: 'IN +91' },
  { code: '+1',  label: 'US +1' },
  { code: '+44', label: 'UK +44' },
  { code: '+61', label: 'AU +61' },
  { code: '+971', label: 'AE +971' },
  { code: '+65', label: 'SG +65' }
];

const PhoneOtpForm: React.FC<Props> = ({ onDone, verifyLabel = 'Verify & Continue' }) => {
  const { loginWithPhone, confirmPhoneOtp } = useAuth();
  const [country, setCountry] = useState('+91');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(id);
  }, [error]);

  // The reCAPTCHA widget binds to the #recaptcha-container DOM node below.
  // Tear it down on unmount so the next mount of this form starts with a
  // fresh widget — otherwise Firebase reuses a verifier whose host node is
  // gone and throws "reCAPTCHA client element has been removed: 0".
  useEffect(() => () => clearRecaptcha(), []);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length < 6) {
      setError('Enter a valid mobile number.');
      return;
    }
    setBusy(true);
    try {
      await loginWithPhone(`${country}${digits}`);
      setStep('otp');
    } catch (err) {
      setError((err as Error).message ?? 'Could not send OTP. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code we sent you.');
      return;
    }
    setBusy(true);
    try {
      await confirmPhoneOtp(code.trim());
      onDone?.();
    } catch (err) {
      setError((err as Error).message ?? 'Invalid OTP. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {step === 'phone' ? (
        <form onSubmit={handleSend} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="otp-phone"
              className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
            >
              Mobile Number
            </label>
            <div className="flex gap-2">
              <select
                aria-label="Country code"
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="input-box w-[110px] shrink-0"
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
                <input
                  id="otp-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  className="input-box pl-9"
                />
              </div>
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

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Sending code…' : 'Send code'}
          </button>

          <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] leading-relaxed">
            We&apos;ll send a one-time code by SMS. Standard carrier rates may apply.
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify} noValidate className="space-y-4">
          <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
            Code sent to <span className="font-bold text-[color:var(--color-myntra-navy)]">{country} {phone}</span>.{' '}
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); }}
              className="font-bold text-[color:var(--color-myntra-pink)] hover:underline"
            >
              Change number
            </button>
          </p>

          <div>
            <label
              htmlFor="otp-code"
              className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
            >
              6-Digit Code
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="123456"
                className="input-box pl-9 tracking-[0.4em]"
              />
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

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Verifying…' : verifyLabel}
          </button>
        </form>
      )}

      {/* reCAPTCHA mounts here once; Firebase requires the node to exist before sendPhoneCode runs. */}
      <div id="recaptcha-container" />
    </div>
  );
};

export default PhoneOtpForm;
