import React from 'react';
import { MapPin } from 'lucide-react';

// Google Maps share link for the physical store.
const STORE_MAPS_URL = 'https://maps.app.goo.gl/TR9kkKiC3oHLanmbA?g_st=iw';

const NavigateToStoreTab: React.FC = () => (
  <a
    href={STORE_MAPS_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Navigate to our store on Google Maps"
    className="fixed left-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2
               bg-[color:var(--color-myntra-pink)] hover:bg-[color:var(--color-myntra-pink-dark)]
               text-white shadow-lg px-3 py-3 rounded-r-lg
               [writing-mode:vertical-rl] rotate-180 transition-colors active:scale-[0.98]"
  >
    <MapPin className="w-4 h-4 rotate-180 shrink-0" aria-hidden="true" />
    <span className="text-[13px] font-semibold tracking-[0.08em] uppercase">
      Navigate to Store
    </span>
  </a>
);

export default NavigateToStoreTab;
