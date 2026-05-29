import React from 'react';
import { MapPin } from 'lucide-react';

const STORE_MAPS_URL = 'https://maps.app.goo.gl/TR9kkKiC3oHLanmbA?g_st=iw';

const NavigateToStoreTab: React.FC = () => (
  <a
    href={STORE_MAPS_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Navigate to our store on Google Maps"
    className="fixed bottom-[5.5rem] right-5 z-50 flex items-center gap-2
               bg-[color:var(--color-myntra-pink)] hover:bg-[color:var(--color-myntra-pink-dark)]
               text-white shadow-lg pl-3 pr-4 py-2.5 rounded-full
               transition-colors active:scale-[0.98]"
  >
    <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
    <span className="text-[13px] font-semibold tracking-[0.06em] uppercase hidden sm:inline">
      Navigate to Store
    </span>
  </a>
);

export default NavigateToStoreTab;
