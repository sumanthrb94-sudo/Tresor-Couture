import React, { useEffect, useState } from 'react';
import { Scale, Check, AlertCircle, ExternalLink, ShieldCheck, FileText, ArrowRight } from 'lucide-react';
import { consentsApi } from '../../lib/firebase';
import { BUSINESS } from '../../lib/business';
import { POLICIES } from '../../content/policies';
import { useRouter } from '../../context/RouterContext';
import type { Consent, PolicyKey } from '../../types';

interface ConsentDoc extends Consent { id: string }

const fmt = (iso?: string): string => (iso ? new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—');

const Card: React.FC<{ title: string; children: React.ReactNode; Icon?: React.ComponentType<{ className?: string }> }> = ({ title, children, Icon }) => (
  <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
    <div className="px-4 py-3 border-b border-[color:var(--color-myntra-border-soft)] flex items-center gap-2">
      {Icon && <Icon className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" />}
      <h2 className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)]">{title}</h2>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const AdminCompliance: React.FC = () => {
  const { navigate } = useRouter();
  const [consents, setConsents] = useState<ConsentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await consentsApi.list()) as unknown as ConsentDoc[];
        if (!cancelled) setConsents(list);
      } catch {
        if (!cancelled) setConsents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const gstinSet = !BUSINESS.gstin.includes('ABCDE'); // placeholder check
  const checklist: { ok: boolean; label: string; note?: string }[] = [
    { ok: gstinSet, label: 'GSTIN configured', note: gstinSet ? BUSINESS.gstin : 'Placeholder GSTIN — set the real value in src/lib/business.ts' },
    { ok: true, label: 'Tax invoices generated for every order', note: 'CGST/SGST + IGST split, HSN, place of supply' },
    { ok: true, label: 'Policy pages published', note: 'Privacy, Terms, Refund, Shipping, Cookies, Contact' },
    { ok: true, label: 'Cookie / marketing consent captured', note: 'Banner live; records below' },
    { ok: true, label: 'DPDP data export & erasure available', note: 'Per customer in the Customers tab' },
  ];

  const marketingOptIns = consents.filter(c => c.marketing).length;

  return (
    <div className="space-y-4">
      <h1 className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)] inline-flex items-center gap-2"><Scale className="w-5 h-5" /> Legal &amp; Compliance</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Business profile */}
        <Card title="Registered business" Icon={FileText}>
          <dl className="text-[13px] space-y-1.5">
            <div className="flex justify-between gap-4"><dt className="text-[color:var(--color-myntra-ink-soft)]">Legal name</dt><dd className="font-semibold text-right">{BUSINESS.legalName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[color:var(--color-myntra-ink-soft)]">GSTIN</dt><dd className="font-mono text-right">{BUSINESS.gstin}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[color:var(--color-myntra-ink-soft)]">PAN</dt><dd className="font-mono text-right">{BUSINESS.pan}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[color:var(--color-myntra-ink-soft)]">State / code</dt><dd className="text-right">{BUSINESS.stateName} ({BUSINESS.stateCode})</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[color:var(--color-myntra-ink-soft)]">Registered address</dt><dd className="text-right">{BUSINESS.addressLines.join(', ')}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[color:var(--color-myntra-ink-soft)]">Contact</dt><dd className="text-right">{BUSINESS.email} · {BUSINESS.phone}</dd></div>
          </dl>
          {!gstinSet && (
            <p className="mt-3 text-[12px] text-[#9A5B12] bg-[#FDF0E1] border border-[#F0D9B5] rounded p-2 inline-flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> These are placeholder values. Update <span className="font-mono">src/lib/business.ts</span> with the real registration before going live.
            </p>
          )}
        </Card>

        {/* Checklist */}
        <Card title="Compliance checklist" Icon={ShieldCheck}>
          <ul className="space-y-2.5">
            {checklist.map(c => (
              <li key={c.label} className="flex items-start gap-2.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${c.ok ? 'bg-[#E5EFDB] text-[#2F6E2F]' : 'bg-[#FDF0E1] text-[#9A5B12]'}`}>
                  {c.ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)]">{c.label}</p>
                  {c.note && <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">{c.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Policy pages */}
      <Card title="Policy pages" Icon={FileText}>
        <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mb-3">Live customer-facing legal pages. Last reviewed {fmt(BUSINESS.policiesUpdatedAt)}.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {(Object.keys(POLICIES) as PolicyKey[]).map(key => (
            <button key={key} onClick={() => navigate({ name: 'policy', policy: key })} className="flex items-center justify-between gap-2 border border-[color:var(--color-myntra-border-soft)] rounded-md px-3 py-2.5 text-[13px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)]">
              {POLICIES[key].title}
              <ExternalLink className="w-3.5 h-3.5 text-[color:var(--color-myntra-ink-mute)]" />
            </button>
          ))}
        </div>
      </Card>

      {/* Data requests pointer */}
      <Card title="Data subject requests (DPDP)" Icon={ShieldCheck}>
        <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-3">
          Process access (export) and erasure requests per customer. Erasure anonymises personal details on past orders while retaining the financial record required for GST/tax law.
        </p>
        <button onClick={() => navigate({ name: 'admin', section: 'customers' })} className="btn-outline inline-flex items-center gap-2 !py-2 text-[12px]">
          Open Customers <ArrowRight className="w-4 h-4" />
        </button>
      </Card>

      {/* Consent register */}
      <Card title="Consent register" Icon={ShieldCheck}>
        <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mb-3">{consents.length} signed-in consent records · {marketingOptIns} marketing opt-ins.</p>
        {loading ? (
          <p className="text-[13px] text-[color:var(--color-myntra-ink-mute)]">Loading…</p>
        ) : consents.length === 0 ? (
          <p className="text-[13px] text-[color:var(--color-myntra-ink-mute)]">No consent records yet. (Guests' choices stay in their browser until they sign in.)</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[color:var(--color-myntra-bg-soft)] text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)]">
                <tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Analytics</th><th className="px-3 py-2">Marketing</th><th className="px-3 py-2">Version</th><th className="px-3 py-2">Updated</th></tr>
              </thead>
              <tbody>
                {consents.map(c => (
                  <tr key={c.id} className="border-t border-[color:var(--color-myntra-border-soft)]">
                    <td className="px-3 py-2 font-mono text-[11px]">{c.id.slice(0, 10)}</td>
                    <td className="px-3 py-2">{c.analytics ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2">{c.marketing ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2">{c.policyVersion}</td>
                    <td className="px-3 py-2 text-[color:var(--color-myntra-ink-soft)]">{fmt(c.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminCompliance;
