import React, { useMemo, useState } from 'react';
import { AlertTriangle, AlertCircle, Info, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useCatalog } from '../../context/CatalogContext';
import { auditCatalogue, type SeoIssue, type Severity } from '../../lib/seoAudit';

const SEVERITY: Record<Severity, { label: string; Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  critical: { label: 'Critical', Icon: AlertTriangle, cls: 'text-[color:var(--color-myntra-pink)]' },
  warning:  { label: 'Warning',  Icon: AlertCircle,  cls: 'text-[#B7791F]' },
  notice:   { label: 'Notice',   Icon: Info,         cls: 'text-[color:var(--color-myntra-ink-mute)]' },
};

const IssueCard: React.FC<{ issue: SeoIssue; nameOf: (id: string) => string }> = ({ issue, nameOf }) => {
  const [open, setOpen] = useState(false);
  const { label, Icon, cls } = SEVERITY[issue.severity];
  const shown = open ? issue.productIds : issue.productIds.slice(0, 6);

  return (
    <div className="border border-[color:var(--color-myntra-border-soft)] rounded bg-white">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${cls}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-[15px] font-extrabold text-[color:var(--color-myntra-navy)]">{issue.title}</h3>
              <span className={`text-[11px] font-extrabold uppercase tracking-wider ${cls}`}>{label}</span>
              <span className="text-[12px] font-bold text-[color:var(--color-myntra-ink-mute)]">
                {issue.productIds.length} product{issue.productIds.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-[13px] text-[color:var(--color-myntra-ink)] mt-1.5 leading-relaxed">{issue.why}</p>
            <p className="text-[13px] text-[color:var(--color-myntra-navy)] mt-2">
              <span className="font-bold">Fix: </span>{issue.fix}
            </p>

            <ul className="mt-3 flex flex-wrap gap-1.5">
              {shown.map(id => (
                <li
                  key={id}
                  title={id}
                  className="text-[11px] font-semibold bg-[color:var(--color-myntra-bg-soft)] border border-[color:var(--color-myntra-border-soft)] rounded px-2 py-1 max-w-[240px] truncate"
                >
                  {nameOf(id)}
                </li>
              ))}
            </ul>

            {issue.productIds.length > 6 && (
              <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="mt-2 text-[12px] font-bold text-[color:var(--color-myntra-pink)] inline-flex items-center gap-1"
              >
                {open
                  ? <>Show fewer <ChevronUp className="w-3.5 h-3.5" /></>
                  : <>Show all {issue.productIds.length} <ChevronDown className="w-3.5 h-3.5" /></>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminSeo: React.FC = () => {
  const { products, loading } = useCatalog();
  const [severity, setSeverity] = useState<Severity | 'all'>('all');

  const result = useMemo(() => auditCatalogue(products ?? []), [products]);

  const nameOf = useMemo(() => {
    const m = new Map((products ?? []).map(p => [p.id, p.name || p.id]));
    return (id: string) => m.get(id) ?? id;
  }, [products]);

  const visible = severity === 'all' ? result.issues : result.issues.filter(i => i.severity === severity);
  const count = (s: Severity) => result.issues.filter(i => i.severity === s).length;

  if (loading) {
    return <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)]">Loading catalogue…</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[color:var(--color-myntra-navy)] flex items-center gap-2">
          <Search className="w-6 h-6" /> Catalogue SEO
        </h1>
        <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-1 max-w-3xl">
          Audits your own product data — no external service, no API key, no request budget. It finds the
          things that stop a product ranking or stop a shopper trusting it. Backlinks and competitor
          rankings are deliberately not here: that data cannot be self-hosted.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="border border-[color:var(--color-myntra-border-soft)] rounded p-4 bg-white">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)]">Clean products</p>
          <p className="text-2xl font-extrabold text-[color:var(--color-myntra-navy)] mt-1">{result.score}%</p>
          <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-1">
            {result.scanned - result.criticalProducts} of {result.scanned} with nothing critical
          </p>
        </div>
        <div className="border border-[color:var(--color-myntra-border-soft)] rounded p-4 bg-white">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)]">Critical</p>
          <p className="text-2xl font-extrabold text-[color:var(--color-myntra-pink)] mt-1">{count('critical')}</p>
        </div>
        <div className="border border-[color:var(--color-myntra-border-soft)] rounded p-4 bg-white">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)]">Warnings</p>
          <p className="text-2xl font-extrabold text-[#B7791F] mt-1">{count('warning')}</p>
        </div>
        <div className="border border-[color:var(--color-myntra-border-soft)] rounded p-4 bg-white">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)]">Products scanned</p>
          <p className="text-2xl font-extrabold text-[color:var(--color-myntra-navy)] mt-1">{result.scanned}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'critical', 'warning', 'notice'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setSeverity(s)}
            className={`text-[12px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border ${
              severity === s
                ? 'bg-[color:var(--color-myntra-navy)] text-white border-[color:var(--color-myntra-navy)]'
                : 'bg-white text-[color:var(--color-myntra-navy)] border-[color:var(--color-myntra-border-soft)]'
            }`}
          >
            {s === 'all' ? `All (${result.issues.length})` : `${SEVERITY[s].label} (${count(s)})`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="border border-[color:var(--color-myntra-border-soft)] rounded bg-white p-8 text-center">
          <p className="text-[15px] font-bold text-[color:var(--color-myntra-navy)]">Nothing to fix here.</p>
          <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-1">
            No issues at this severity across {result.scanned} products.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(i => <IssueCard key={i.rule} issue={i} nameOf={nameOf} />)}
        </div>
      )}
    </div>
  );
};

export default AdminSeo;
