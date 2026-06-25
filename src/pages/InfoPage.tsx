import React, { useEffect } from 'react';
import { Mail, Phone, Instagram, ChevronRight } from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { INFO_PAGES, COMPANY, LEGAL_UPDATED } from '../content/legal';

/**
 * Renders a static content page (legal/policy, support, brand) by slug from
 * src/content/legal.tsx. Unknown slugs fall through to the not-found route.
 */
const InfoPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { navigate } = useRouter();
  const page = INFO_PAGES[slug];

  useEffect(() => {
    if (page) {
      document.title = `${page.title} · ${COMPANY.brand}`;
    } else {
      // Unknown slug → defer to the app's 404 view. Use a non-"p/" path so
      // re-parsing the hash doesn't route back into this page and loop.
      navigate({ name: 'not-found', path: encodeURIComponent(slug) });
    }
  }, [page, slug, navigate]);

  if (!page) return null;

  return (
    <main className="pt-[100px] md:pt-[120px] pb-16 min-h-screen bg-white">
      <div className="max-w-[820px] mx-auto px-4 md:px-8">
        {/* Breadcrumb */}
        <nav className="text-[12px] text-[color:var(--color-myntra-ink-mute)] mb-5 flex items-center gap-1.5">
          <button onClick={() => navigate({ name: 'home' })} className="hover:text-[color:var(--color-myntra-pink)]">Home</button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[color:var(--color-myntra-ink-soft)]">{page.title}</span>
        </nav>

        <h1 className="font-[Cormorant_Garamond,serif] text-[34px] md:text-[44px] leading-tight text-[color:var(--color-myntra-navy)]">
          {page.title}
        </h1>
        {page.legal && (
          <p className="text-[12px] text-[color:var(--color-myntra-ink-mute)] mt-2">Last updated: {LEGAL_UPDATED}</p>
        )}
        {page.lede && (
          <p className="text-[15px] text-[color:var(--color-myntra-ink-soft)] leading-relaxed mt-4 max-w-[680px]">{page.lede}</p>
        )}

        <div className="mt-8 space-y-8">
          {page.sections.map((s, i) => (
            <section key={i}>
              {s.h && (
                <h2 className="text-[16px] font-extrabold text-[color:var(--color-myntra-navy)] mb-2.5">{s.h}</h2>
              )}
              {s.p?.map((para, j) => (
                <p key={j} className="text-[14px] text-[color:var(--color-myntra-ink-soft)] leading-relaxed mb-2.5">{para}</p>
              ))}
              {s.ul && (
                <ul className="list-disc pl-5 space-y-1.5 text-[14px] text-[color:var(--color-myntra-ink-soft)] leading-relaxed">
                  {s.ul.map((li, j) => <li key={j}>{li}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Quick contact actions on the Contact page */}
        {slug === 'contact' && (
          <div className="mt-9 flex flex-wrap gap-3">
            <a href={`mailto:${COMPANY.email}`} className="btn-primary inline-flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email us
            </a>
            <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="btn-outline inline-flex items-center gap-2">
              <Phone className="w-4 h-4" /> Call / WhatsApp
            </a>
            <a href={COMPANY.instagram} target="_blank" rel="noreferrer" className="btn-outline inline-flex items-center gap-2">
              <Instagram className="w-4 h-4" /> Instagram
            </a>
          </div>
        )}

        {/* Cross-links to the other policies */}
        <div className="mt-12 pt-6 border-t border-[color:var(--color-myntra-border-soft)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[color:var(--color-myntra-ink-mute)] mb-3">More information</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(['shipping', 'returns', 'cancellation', 'privacy', 'terms', 'faq', 'contact'] as const)
              .filter(s => s !== slug)
              .map(s => (
                <button
                  key={s}
                  onClick={() => navigate({ name: 'page', slug: s })}
                  className="text-[13px] text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-pink)] transition-colors"
                >
                  {INFO_PAGES[s].title}
                </button>
              ))}
          </div>
        </div>
      </div>
    </main>
  );
};

export default InfoPage;
