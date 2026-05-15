import React, { useMemo, useState } from 'react';
import { Star, Check, X, MessageSquare } from 'lucide-react';
import type { Review } from '../../types';
import { reviewsStore, fabricsStore } from '../../data/storage';
import { useStore } from '../../data/useStore';

type ReviewStatus = Review['status'];

const TABS: { id: ReviewStatus; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' }
];

const STATUS_STYLE: Record<ReviewStatus, { bg: string; text: string; border: string; label: string }> = {
  pending:  { bg: '#FDF0E1', text: '#A0561A', border: '#F4D6B5', label: 'Pending' },
  approved: { bg: '#E5EFDB', text: '#3F5A26', border: '#C7D9AE', label: 'Approved' },
  rejected: { bg: '#FBE6E6', text: '#A12626', border: '#F0C7C7', label: 'Rejected' }
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const StatusPill: React.FC<{ status: ReviewStatus }> = ({ status }) => {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {s.label}
    </span>
  );
};

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
    {[1, 2, 3, 4, 5].map(n => (
      <Star
        key={n}
        className={`w-3.5 h-3.5 ${
          n <= rating
            ? 'fill-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]'
            : 'text-[color:var(--color-myntra-border)]'
        }`}
      />
    ))}
  </div>
);

/**
 * Recompute a fabric's aggregate rating & reviewCount from currently-approved
 * reviews. Called after every approve/reject so the storefront stays in sync.
 */
async function recomputeFabricRating(fabricId: string): Promise<void> {
  const all = await reviewsStore.list();
  const approved = all.filter(r => r.fabricId === fabricId && r.status === 'approved');
  if (approved.length === 0) {
    await fabricsStore.update(fabricId, { rating: 0, reviewCount: 0 });
    return;
  }
  const sum = approved.reduce((acc, r) => acc + r.rating, 0);
  const avg = sum / approved.length;
  // Round to 1 decimal for display consistency.
  const rating = Math.round(avg * 10) / 10;
  await fabricsStore.update(fabricId, { rating, reviewCount: approved.length });
}

const AdminReviews: React.FC = () => {
  const { rows: reviews, loading } = useStore(reviewsStore);
  const { rows: fabrics } = useStore(fabricsStore);
  const [tab, setTab] = useState<ReviewStatus>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fabricsById = useMemo(() => {
    const map = new Map<string, (typeof fabrics)[number]>();
    for (const f of fabrics) map.set(f.id, f);
    return map;
  }, [fabrics]);

  const counts = useMemo(() => {
    const c: Record<ReviewStatus, number> = { pending: 0, approved: 0, rejected: 0 };
    for (const r of reviews) c[r.status]++;
    return c;
  }, [reviews]);

  const visible = useMemo(
    () =>
      reviews
        .filter(r => r.status === tab)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reviews, tab]
  );

  const changeStatus = async (review: Review, next: ReviewStatus) => {
    if (review.status === next) return;
    setBusyId(review.id);
    try {
      await reviewsStore.update(review.id, { status: next });
      await recomputeFabricRating(review.fabricId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 md:p-5">
        <h1 className="font-[family-name:var(--font-display)] text-[20px] md:text-[22px] font-extrabold text-[color:var(--color-myntra-navy)] leading-tight">
          Reviews
        </h1>
        <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-0.5">
          Moderate customer reviews before they appear on product pages.
        </p>

        <div className="mt-4 flex gap-1 overflow-x-auto -mx-1 px-1">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-[12px] font-bold uppercase tracking-wider rounded transition-colors shrink-0 inline-flex items-center gap-2 ${
                  active
                    ? 'bg-[color:var(--color-myntra-pink)] text-white'
                    : 'text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)]'
                }`}
              >
                {t.label}
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                    active
                      ? 'bg-white/25 text-white'
                      : 'bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-ink-soft)]'
                  }`}
                >
                  {counts[t.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-10 text-center text-[13px] text-[color:var(--color-myntra-ink-soft)]">
          Loading reviews…
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-10 md:p-14 text-center">
          <MessageSquare className="w-10 h-10 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-3" />
          <h2 className="text-[16px] font-extrabold text-[color:var(--color-myntra-navy)] mb-1">
            No {tab} reviews
          </h2>
          <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
            {tab === 'pending'
              ? 'New customer reviews will appear here for moderation.'
              : `No ${tab} reviews in the queue.`}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map(r => {
            const fabric = fabricsById.get(r.fabricId);
            const busy = busyId === r.id;
            return (
              <li
                key={r.id}
                className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 flex flex-col md:flex-row gap-4"
              >
                {/* Product */}
                <div className="flex items-center gap-3 md:w-[260px] md:shrink-0">
                  <div className="w-14 h-16 rounded overflow-hidden bg-[color:var(--color-myntra-bg-soft)] shrink-0">
                    {fabric ? (
                      <img
                        src={fabric.photo}
                        alt={fabric.name}
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).src = fabric.image;
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-[color:var(--color-myntra-ink-mute)]">
                        —
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] truncate">
                      {fabric?.brand ?? 'Unknown brand'}
                    </p>
                    <p className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)] truncate">
                      {fabric?.name ?? r.fabricId}
                    </p>
                    <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] mt-0.5">
                      {formatDate(r.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Review body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Stars rating={r.rating} />
                    <span className="text-[12px] font-bold text-[color:var(--color-myntra-navy)]">{r.authorName}</span>
                    <StatusPill status={r.status} />
                  </div>
                  {r.title && (
                    <p className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] mb-1">{r.title}</p>
                  )}
                  <p className="text-[13px] text-[color:var(--color-myntra-ink)] leading-relaxed line-clamp-4">{r.body}</p>
                </div>

                {/* Actions */}
                <div className="flex md:flex-col gap-2 md:w-[160px] md:shrink-0 md:items-stretch md:justify-center">
                  {r.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => changeStatus(r, 'approved')}
                      disabled={busy}
                      className="btn-primary inline-flex items-center justify-center gap-1.5 flex-1 md:flex-initial text-[12px] py-2"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => changeStatus(r, 'rejected')}
                      disabled={busy}
                      className="btn-outline inline-flex items-center justify-center gap-1.5 flex-1 md:flex-initial text-[12px] py-2"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                  )}
                  {r.status === 'approved' && (
                    <button
                      type="button"
                      onClick={() => changeStatus(r, 'pending')}
                      disabled={busy}
                      className="btn-outline inline-flex items-center justify-center gap-1.5 flex-1 md:flex-initial text-[12px] py-2"
                    >
                      Unpublish
                    </button>
                  )}
                  {r.status === 'rejected' && (
                    <button
                      type="button"
                      onClick={() => changeStatus(r, 'pending')}
                      disabled={busy}
                      className="btn-outline inline-flex items-center justify-center gap-1.5 flex-1 md:flex-initial text-[12px] py-2"
                    >
                      Move to pending
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AdminReviews;
