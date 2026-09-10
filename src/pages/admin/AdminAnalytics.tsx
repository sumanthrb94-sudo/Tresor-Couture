import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Users, Eye, RefreshCw, AlertCircle, Settings } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useCatalog } from '../../context/CatalogContext';

/**
 * Views — the traffic the shop actually got, inside the admin.
 *
 * Vercel Web Analytics already collects this; the numbers just lived behind a
 * Vercel login, which the studio does not have open. Nothing new is tracked
 * here: this reads the same counts through /api/admin/analytics, which holds
 * the API token server-side because it can read the whole Vercel account and
 * must never reach the browser.
 *
 * Deliberately NOT a second analytics pipeline. Writing our own page-view
 * counter into Firestore would need a publicly-writable collection — anyone
 * could inflate it or run up the bill — to produce worse numbers than the ones
 * already being collected.
 */

interface Payload {
  range: { since: string; until: string; days: number };
  totals: { visitors: number; pageviews: number };
  byDay: { date: string; visitors: number; pageviews: number }[];
  byPath: { path: string; visitors: number; pageviews: number }[];
  byReferrer: { referrer: string; visitors: number }[];
  byDevice: { device: string; visitors: number }[];
}

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
];

/** Own visits to /admin are the studio's own, and they drown out the shop. */
const isAdminPath = (p: string): boolean => p === '/admin' || p.startsWith('/admin/');

const Stat: React.FC<{ label: string; value: string; Icon: React.ComponentType<{ className?: string }> }> = ({
  label, value, Icon,
}) => (
  <div className="border border-[color:var(--color-myntra-border-soft)] rounded bg-white p-4">
    <div className="flex items-center gap-2 text-[color:var(--color-myntra-ink-mute)]">
      <Icon className="w-4 h-4" />
      <span className="text-[11px] font-extrabold uppercase tracking-[0.12em]">{label}</span>
    </div>
    <div className="mt-1.5 text-[26px] font-extrabold text-[color:var(--color-myntra-navy)] leading-none">
      {value}
    </div>
  </div>
);

/** A bar row — a plain div width, so there is no charting dependency to ship. */
const Bar: React.FC<{ label: string; title?: string; value: number; max: number; right: string }> = ({
  label, title, value, max, right,
}) => (
  <li className="py-1.5">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-[color:var(--color-myntra-navy)] truncate" title={title ?? label}>
        {label}
      </span>
      <span className="text-[12px] font-bold text-[color:var(--color-myntra-ink-mute)] shrink-0 tabular-nums">
        {right}
      </span>
    </div>
    <div className="mt-1 h-1.5 rounded-full bg-[color:var(--color-myntra-bg-soft)] overflow-hidden">
      <div
        className="h-full rounded-full bg-[color:var(--color-myntra-pink)]"
        style={{ width: `${max > 0 ? Math.max((value / max) * 100, 2) : 0}%` }}
      />
    </div>
  </li>
);

const AdminAnalytics: React.FC = () => {
  const { products } = useCatalog();
  const [days, setDays] = useState(30);
  const [includeAdmin, setIncludeAdmin] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unconfigured' | 'error'>('loading');
  const [detail, setDetail] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const user = auth.currentUser;
      if (!user) { setState('error'); setDetail('Not signed in.'); return; }
      const token = await user.getIdToken();
      const r = await fetch(`/api/admin/analytics?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 503) { setState('unconfigured'); return; }
      if (!r.ok) {
        setState('error');
        setDetail(`The analytics service answered ${r.status}.`);
        return;
      }
      setData((await r.json()) as Payload);
      setState('ready');
    } catch {
      setState('error');
      setDetail('Could not reach the analytics service.');
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  // A product URL is /product/<id>, and an id tells the studio nothing. Show
  // the piece's name so the popular-pages table is readable.
  const nameOf = useMemo(() => {
    const byId = new Map(products.map(p => [p.id, p.name]));
    return (path: string): string => {
      const m = /^\/product\/(.+)$/.exec(path);
      if (!m) return path;
      const name = byId.get(decodeURIComponent(m[1]));
      return name ? `${name}` : path;
    };
  }, [products]);

  const paths = useMemo(
    () => (data?.byPath ?? []).filter(r => includeAdmin || !isAdminPath(r.path)).slice(0, 15),
    [data, includeAdmin],
  );

  // Totals follow the same filter, or the table and the headline disagree:
  // 26 of the top pageviews in a quiet month are the studio's own admin visits.
  const shown = useMemo(() => {
    if (!data) return { visitors: 0, pageviews: 0 };
    if (includeAdmin) return data.totals;
    const kept = data.byPath.filter(r => !isAdminPath(r.path));
    return {
      // Visitors cannot be summed across paths without double-counting one
      // person who read three pages, so only pageviews get a filtered total.
      visitors: data.totals.visitors,
      pageviews: kept.reduce((n, r) => n + r.pageviews, 0),
    };
  }, [data, includeAdmin]);

  const maxDay = Math.max(1, ...(data?.byDay ?? []).map(d => d.pageviews));
  const maxPath = Math.max(1, ...paths.map(p => p.pageviews));

  return (
    <div className="p-4 md:p-6 max-w-[1100px]">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <h1 className="text-[20px] md:text-[22px] font-extrabold text-[color:var(--color-myntra-navy)] flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Views
        </h1>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded border border-[color:var(--color-myntra-border-soft)] hover:bg-[color:var(--color-myntra-bg-soft)]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      <p className="text-[13px] text-[color:var(--color-myntra-ink-mute)] mb-4">
        Traffic to the storefront, from Vercel Web Analytics.
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {RANGES.map(r => (
          <button
            key={r.days}
            type="button"
            onClick={() => setDays(r.days)}
            className={`text-[12px] font-bold px-3 py-1.5 rounded border ${
              days === r.days
                ? 'bg-[color:var(--color-myntra-navy)] text-white border-[color:var(--color-myntra-navy)]'
                : 'border-[color:var(--color-myntra-border-soft)] hover:bg-[color:var(--color-myntra-bg-soft)]'
            }`}
          >
            {r.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[12px] font-semibold text-[color:var(--color-myntra-ink)]">
          <input type="checkbox" checked={includeAdmin} onChange={e => setIncludeAdmin(e.target.checked)} />
          Include my own admin visits
        </label>
      </div>

      {state === 'unconfigured' && (
        <div className="border border-[color:var(--color-myntra-border-soft)] rounded bg-white p-5">
          <div className="flex items-start gap-3">
            <Settings className="w-5 h-5 shrink-0 mt-0.5 text-[#B7791F]" />
            <div className="text-[13px] leading-relaxed">
              <h2 className="text-[15px] font-extrabold text-[color:var(--color-myntra-navy)] mb-1">
                One setting left
              </h2>
              <p className="text-[color:var(--color-myntra-ink)]">
                The views are already being collected — this page just needs a read-only Vercel API
                token to fetch them. In Vercel: <span className="font-bold">Account Settings → Tokens
                → Create</span>, scope it to this team, then add it to the project's environment
                variables as <code className="font-mono">VERCEL_API_TOKEN</code>, along with{' '}
                <code className="font-mono">VERCEL_PROJECT_ID</code> and{' '}
                <code className="font-mono">VERCEL_TEAM_ID</code>. Redeploy and this page fills in.
              </p>
            </div>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="border border-[color:var(--color-myntra-border-soft)] rounded bg-white p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[color:var(--color-myntra-pink)]" />
          <div className="text-[13px]">
            <span className="font-bold text-[color:var(--color-myntra-navy)]">Could not load views. </span>
            <span className="text-[color:var(--color-myntra-ink)]">{detail}</span>
          </div>
        </div>
      )}

      {state === 'loading' && !data && (
        <p className="text-[13px] text-[color:var(--color-myntra-ink-mute)]">Loading…</p>
      )}

      {data && (state === 'ready' || state === 'loading') && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            <Stat label="Page views" value={shown.pageviews.toLocaleString('en-IN')} Icon={Eye} />
            <Stat label="Visitors" value={shown.visitors.toLocaleString('en-IN')} Icon={Users} />
            <Stat
              label="Views per visitor"
              value={shown.visitors ? (shown.pageviews / shown.visitors).toFixed(1) : '—'}
              Icon={BarChart3}
            />
          </div>

          <section className="border border-[color:var(--color-myntra-border-soft)] rounded bg-white p-4 mb-4">
            <h2 className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] mb-2">
              Most viewed pages
            </h2>
            {paths.length === 0 ? (
              <p className="text-[13px] text-[color:var(--color-myntra-ink-mute)]">
                No storefront views in this window.
              </p>
            ) : (
              <ul>
                {paths.map(p => (
                  <Bar
                    key={p.path}
                    label={nameOf(p.path)}
                    title={p.path}
                    value={p.pageviews}
                    max={maxPath}
                    right={`${p.pageviews.toLocaleString('en-IN')} views · ${p.visitors} visitors`}
                  />
                ))}
              </ul>
            )}
          </section>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <section className="border border-[color:var(--color-myntra-border-soft)] rounded bg-white p-4">
              <h2 className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] mb-2">
                Where they came from
              </h2>
              {data.byReferrer.length === 0 ? (
                <p className="text-[13px] text-[color:var(--color-myntra-ink-mute)]">
                  All direct — nobody arrived from a link yet.
                </p>
              ) : (
                <ul>
                  {data.byReferrer.map(r => (
                    <Bar
                      key={r.referrer}
                      label={r.referrer}
                      value={r.visitors}
                      max={Math.max(1, ...data.byReferrer.map(x => x.visitors))}
                      right={`${r.visitors}`}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section className="border border-[color:var(--color-myntra-border-soft)] rounded bg-white p-4">
              <h2 className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] mb-2">
                Phone or desktop
              </h2>
              <ul>
                {data.byDevice.map(d => (
                  <Bar
                    key={d.device}
                    label={d.device}
                    value={d.visitors}
                    max={Math.max(1, ...data.byDevice.map(x => x.visitors))}
                    right={`${d.visitors}`}
                  />
                ))}
              </ul>
            </section>
          </div>

          <section className="border border-[color:var(--color-myntra-border-soft)] rounded bg-white p-4">
            <h2 className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] mb-3">
              Day by day
            </h2>
            <div className="flex items-end gap-[3px] h-28 overflow-x-auto">
              {data.byDay.map(d => (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.pageviews} views, ${d.visitors} visitors`}
                  className="flex-1 min-w-[4px] bg-[color:var(--color-myntra-pink)] rounded-t"
                  style={{ height: `${Math.max((d.pageviews / maxDay) * 100, 2)}%` }}
                />
              ))}
            </div>
            {data.byDay.length > 0 && (
              <div className="flex justify-between text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-1.5">
                <span>{data.byDay[0].date}</span>
                <span>{data.byDay[data.byDay.length - 1].date}</span>
              </div>
            )}
          </section>

          <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-4 leading-relaxed">
            Counted only for visitors who accepted the cookie banner, so the real figures are
            somewhat higher. Views of a page are counted; a visitor who reads three pages is one
            visitor.
          </p>
        </>
      )}
    </div>
  );
};

export default AdminAnalytics;
