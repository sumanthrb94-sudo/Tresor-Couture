import React from 'react';
import { useRouter } from '../context/RouterContext';

const Footer = () => {
  const { navigate } = useRouter();

  const links = [
    { label: 'Shipping', onClick: () => navigate({ name: 'home' }) },
    { label: 'Returns', onClick: () => navigate({ name: 'home' }) },
    { label: 'Privacy Policy', onClick: () => navigate({ name: 'home' }) },
    { label: 'Contact', onClick: () => navigate({ name: 'home' }) },
    { label: 'Instagram', onClick: () => navigate({ name: 'home' }) },
    { label: 'Pinterest', onClick: () => navigate({ name: 'home' }) }
  ];

  return (
    <footer
      id="contact"
      className="bg-brand-bg-soft w-full py-[120px] px-6 md:px-16 border-t border-brand-gold/20"
    >
      <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
        <div className="flex flex-col gap-4">
          <span className="font-serif italic text-[28px] gold-text">Tresor Couture</span>
          <p className="text-base text-brand-ink-soft max-w-xs">
            © 2026 Trésor Couture. Artisanal textiles for the discerning creator.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-8 gap-y-4">
          {links.map(l => (
            <button
              key={l.label}
              onClick={l.onClick}
              className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft hover:text-brand-gold hover:underline decoration-brand-gold underline-offset-4 transition-all duration-300"
            >
              {l.label}
            </button>
          ))}
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
