import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App.tsx';
import './index.css';
import { initAnalytics } from './lib/analytics';
import { initSentry } from './lib/sentry';

// Initialize Sentry first so it captures any errors during app startup.
initSentry();

// Only initialize analytics/performance trackers when the visitor has
// explicitly opted in via the consent banner (DPDP compliance).
function readAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem('tresor.consent.v1');
    if (!raw) return false;
    return (JSON.parse(raw).analytics === true);
  } catch {
    return false;
  }
}
const analyticsConsent = readAnalyticsConsent();
initAnalytics(analyticsConsent);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Vercel Web Analytics + Speed Insights are gated on consent. */}
    {analyticsConsent && <Analytics />}
    {analyticsConsent && <SpeedInsights />}
  </StrictMode>,
);
