import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { POLICIES } from '../content/policies';
import { BUSINESS, gstinConfigured } from '../lib/business';
import type { PolicyKey } from '../types';

type Block = { type: 'list'; items: string[] } | { type: 'para'; text: string };

/** Fold a section's paragraph array into render blocks, merging consecutive
 *  "• " bullet lines into a single list. */
function groupParagraphs(body: string[]): Block[] {
  const blocks: Block[] = [];
  for (const para of body) {
    if (para.trim().startsWith('• ')) {
      const item = para.replace(/^•\s*/, '');
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'list') last.items.push(item);
      else blocks.push({ type: 'list', items: [item] });
    } else {
      blocks.push({ type: 'para', text: para });
    }
  }
  return blocks;
}

/** Renders any one of the static policy pages by key. One component, driven by
 *  the content map in src/content/policies.ts. */
const LegalPage: React.FC<{ policy: PolicyKey }> = ({ policy }) => {
  const { navigate } = useRouter();
  const doc = POLICIES[policy];
  const updated = new Date(BUSINESS.policiesUpdatedAt).toLocaleDateString('en-IN', { dateStyle: 'long' });

  return (
    <main className="pt-[100px] min-h-screen bg-[color:var(--color-myntra-bg-soft)]">
      <div className="max-w-[820px] mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[12px] text-[color:var(--color-myntra-ink-soft)] mb-4">
          <button onClick={() => navigate({ name: 'home' })} className="hover:text-[color:var(--color-myntra-pink)]">Home</button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-[color:var(--color-myntra-navy)] font-semibold">{doc.title}</span>
        </nav>

        <article className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-6 md:p-10">
          <h1 className="font-serif text-[26px] md:text-[32px] font-extrabold text-[color:var(--color-myntra-navy)]">{doc.title}</h1>
          <p className="text-[12px] text-[color:var(--color-myntra-ink-mute)] mt-1">Last updated {updated}</p>
          <p className="text-[14px] leading-relaxed text-[color:var(--color-myntra-ink-soft)] mt-4">{doc.intro}</p>

          <div className="mt-8 space-y-7">
            {doc.sections.map(section => (
              <section key={section.heading}>
                <h2 className="text-[16px] font-extrabold text-[color:var(--color-myntra-navy)] mb-2">{section.heading}</h2>
                <div className="space-y-2">
                  {groupParagraphs(section.body).map((block, i) =>
                    block.type === 'list' ? (
                      <ul key={i} className="list-disc pl-5 space-y-1">
                        {block.items.map((l, j) => (
                          <li key={j} className="text-[14px] leading-relaxed text-[color:var(--color-myntra-ink-soft)]">{l}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={i} className="text-[14px] leading-relaxed text-[color:var(--color-myntra-ink-soft)]">{block.text}</p>
                    )
                  )}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-10 pt-5 border-t border-[color:var(--color-myntra-border-soft)] text-[12px] text-[color:var(--color-myntra-ink-mute)]">
            {BUSINESS.legalName}
            {gstinConfigured() && <> · GSTIN {BUSINESS.gstin}</>}
            {' · '}{BUSINESS.email}
          </div>
        </article>
      </div>
    </main>
  );
};

export default LegalPage;
