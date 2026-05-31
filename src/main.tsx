import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App.tsx';
import './index.css';
import { initAnalytics } from './lib/analytics';

// No-ops unless VITE_GA4_ID is configured (e.g. in Vercel production env).
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Vercel Web Analytics (traffic) + Speed Insights (real-user Core Web
        Vitals). Both are no-ops in local dev and only beacon in production. */}
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
);
