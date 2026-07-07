/**
 * hCaptcha checkbox widget.
 *
 * Renders an hCaptcha challenge and calls `onVerify(token)` when solved.
 * The token must be sent to a server endpoint that verifies it with
 * HCAPTCHA_SECRET.
 */
import React, { useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'hcaptcha-script';
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const SITE_KEY = env.VITE_HCAPTCHA_SITE_KEY;

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: string | HTMLElement, opts: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback'?: () => void;
        theme?: 'light' | 'dark';
        size?: 'normal' | 'compact' | 'invisible';
      }) => number;
      reset?: (id?: number) => void;
    };
  }
}

interface CaptchaProps {
  onVerify: (token: string | null) => void;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact';
}

export const captchaConfigured: boolean = Boolean(SITE_KEY);

const Captcha: React.FC<CaptchaProps> = ({ onVerify, theme = 'light', size = 'normal' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!SITE_KEY) {
      onVerify(null);
      return;
    }

    const render = () => {
      if (!containerRef.current || !window.hcaptcha) return;
      if (widgetIdRef.current != null && window.hcaptcha.reset) {
        window.hcaptcha.reset(widgetIdRef.current);
      }
      widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => onVerify(token),
        'error-callback': () => onVerify(null),
        theme,
        size,
      });
    };

    if (window.hcaptcha) {
      render();
      setLoaded(true);
      return;
    }

    let existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!existing) {
      existing = document.createElement('script');
      existing.id = SCRIPT_ID;
      existing.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
      existing.async = true;
      existing.defer = true;
      existing.onload = () => {
        setLoaded(true);
        render();
      };
      existing.onerror = () => {
        console.error('[Captcha] hCaptcha script failed to load');
        onVerify(null);
      };
      document.body.appendChild(existing);
    } else if (window.hcaptcha) {
      render();
      setLoaded(true);
    }

    return () => {
      if (widgetIdRef.current != null && window.hcaptcha?.reset) {
        window.hcaptcha.reset(widgetIdRef.current);
      }
    };
  }, [onVerify, theme, size]);

  if (!SITE_KEY) return null;

  return (
    <div className="min-h-[78px]">
      {!loaded && <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">Loading security check…</p>}
      <div ref={containerRef} className={loaded ? '' : 'hidden'} />
    </div>
  );
};

export default Captcha;
