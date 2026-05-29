import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// WhatsApp brand glyph as an inline SVG — lucide-react has no WhatsApp icon,
// and inlining keeps the button self-contained with no extra asset to load.
const WhatsAppGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="currentColor">
    <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.74 6.4L3.2 28.8l6.56-1.72a12.74 12.74 0 0 0 6.24 1.6h.005c7.06 0 12.8-5.74 12.8-12.8s-5.74-12.68-12.8-12.68Zm0 23.04h-.004a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-4.04 1.06 1.08-3.94-.25-.4a10.6 10.6 0 0 1-1.63-5.65c0-5.86 4.77-10.63 10.64-10.63 2.84 0 5.51 1.11 7.52 3.12a10.56 10.56 0 0 1 3.11 7.52c0 5.86-4.77 10.63-10.63 10.63Zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.53-.71-.54l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.64 0 1.55 1.14 3.06 1.3 3.27.16.21 2.24 3.42 5.43 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.89-.77 2.16-1.52.27-.74.27-1.38.19-1.51-.08-.13-.29-.21-.61-.37Z" />
  </svg>
);

const WhatsAppButton: React.FC = () => {
  const [showNotice, setShowNotice] = useState(false);

  // Auto-dismiss the "under development" notice so it never lingers on screen.
  useEffect(() => {
    if (!showNotice) return;
    const t = window.setTimeout(() => setShowNotice(false), 3500);
    return () => window.clearTimeout(t);
  }, [showNotice]);

  return (
    <div className="fixed bottom-[4.75rem] right-5 z-50 flex flex-col items-end gap-3">
      {showNotice && (
        <div
          role="status"
          className="relative max-w-[260px] rounded-lg border border-[#E8DCC4] bg-white shadow-lg px-4 py-3 pr-9"
        >
          <button
            onClick={() => setShowNotice(false)}
            aria-label="Dismiss notice"
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[#8E6520] hover:bg-[#FBF7EE] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8E6520] mb-1">
            Contact Us
          </p>
          <p className="text-[13px] text-[color:var(--color-myntra-navy)] leading-snug">
            WhatsApp chat is currently <span className="font-semibold">under development</span>.
            Please check back soon.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowNotice(true)}
        aria-label="Contact us on WhatsApp"
        className="group flex items-center gap-2 rounded-full bg-[#25D366] text-white pl-3.5 pr-4 py-3 shadow-lg hover:bg-[#1ebe5b] active:scale-[0.98] transition-all"
      >
        <WhatsAppGlyph className="w-6 h-6" />
        <span className="text-[14px] font-semibold hidden sm:inline">Contact Us</span>
      </button>
    </div>
  );
};

export default WhatsAppButton;
