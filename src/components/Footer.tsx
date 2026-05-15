import React from 'react';
import { Facebook, Instagram, Twitter, Youtube, Phone, Mail, ShieldCheck, RotateCcw, Truck } from 'lucide-react';
import { useRouter } from '../context/RouterContext';

const cols = [
  {
    title: 'Online Shopping',
    links: ['All Fabrics', 'Silks', 'Cottons', 'Wool', 'Linen', 'Satin', 'Mixed', 'Sale']
  },
  {
    title: 'Customer Policies',
    links: ['Contact Us', 'FAQ', 'Track Order', 'Shipping', 'Cancellation', 'Returns', 'Privacy Policy', 'Terms of Use']
  },
  {
    title: 'The Atelier',
    links: ['About Tresor', 'The Weavers', 'Press', 'Sustainability', 'Careers', 'Atelier Tours']
  }
];

const Footer: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <footer className="bg-[color:var(--color-myntra-bg-soft)] mt-10 md:mt-16">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 pt-10 md:pt-14 pb-6 flex flex-col items-center text-center border-b border-[color:var(--color-myntra-border-soft)]">
        <img
          src="/branding/master-logo-trim.png"
          alt="Trésor Couture"
          className="h-24 md:h-32 w-auto object-contain mb-3 select-none"
          draggable={false}
        />
        <p className="text-[13px] md:text-[14px] text-[color:var(--color-myntra-ink-soft)] max-w-md">
          Heritage Indian weaves, hand-cut to the meter and dispatched with an authenticity card signed by the master weaver.
        </p>
      </div>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 py-10 md:py-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-10">
        {cols.map(col => (
          <div key={col.title}>
            <h4 className="text-[12px] font-extrabold uppercase tracking-[0.15em] text-[color:var(--color-myntra-navy)] mb-4">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map(l => (
                <li key={l}>
                  <button
                    onClick={() => navigate({ name: 'home' })}
                    className="text-[13px] text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-pink)] transition-colors"
                  >
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="col-span-2 md:col-span-4 lg:col-span-2">
          <h4 className="text-[12px] font-extrabold uppercase tracking-[0.15em] text-[color:var(--color-myntra-navy)] mb-4">
            Experience Tresor on Mobile
          </h4>
          <div className="flex gap-3 mb-6">
            <div className="px-4 py-2.5 bg-[color:var(--color-myntra-navy)] text-white rounded-md text-[12px] font-semibold">
              Get on Google Play
            </div>
            <div className="px-4 py-2.5 bg-[color:var(--color-myntra-navy)] text-white rounded-md text-[12px] font-semibold">
              Download on iOS
            </div>
          </div>

          <h4 className="text-[12px] font-extrabold uppercase tracking-[0.15em] text-[color:var(--color-myntra-navy)] mb-3">
            Keep in Touch
          </h4>
          <div className="flex gap-3 mb-6">
            {[Facebook, Instagram, Twitter, Youtube].map((Icon, i) => (
              <a key={i} href="#" className="w-9 h-9 rounded-full bg-white border border-[color:var(--color-myntra-border-soft)] flex items-center justify-center text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-pink)] hover:border-[color:var(--color-myntra-pink)] transition-colors">
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 text-[13px] text-[color:var(--color-myntra-ink-soft)]">
            <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> +91 80 1234 5678</div>
            <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> concierge@tresorcouture.com</div>
          </div>
        </div>
      </div>

      <div className="border-t border-[color:var(--color-myntra-border-soft)] py-5">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 flex flex-col md:flex-row gap-4 items-center justify-between text-[12px] text-[color:var(--color-myntra-ink-soft)]">
          <div className="flex flex-wrap gap-5 md:gap-7">
            <span className="inline-flex items-center gap-1.5"><Truck className="w-4 h-4 text-[color:var(--color-myntra-pink)]" /> Free Shipping over ₹1,999</span>
            <span className="inline-flex items-center gap-1.5"><RotateCcw className="w-4 h-4 text-[color:var(--color-myntra-pink)]" /> Easy 30-Day Returns</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[color:var(--color-myntra-pink)]" /> 100% Authentic Weaves</span>
          </div>
          <p className="flex items-center gap-4">
            <span>© {new Date().getFullYear()} Trésor Couture · All rights reserved.</span>
            <button
              onClick={() => navigate({ name: 'admin' })}
              className="text-[11px] tracking-[0.18em] uppercase hover:text-[color:var(--color-myntra-pink)] transition-colors"
            >
              Atelier Admin
            </button>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
