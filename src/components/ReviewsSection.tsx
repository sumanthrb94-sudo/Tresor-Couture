import React, { useEffect, useMemo, useState } from 'react';
import { Star, MessageSquare } from 'lucide-react';
import type { Review } from '../types';
import { reviewsApi } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';

interface ReviewsSectionProps {
  fabricId: string;
}

const REVIEWS_PAGE_SIZE = 5;

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Stars: React.FC<{ rating: number; size?: 'sm' | 'md' | 'lg' }> = ({ rating, size = 'sm' }) => {
  const sizing = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`${sizing} ${
            n <= Math.round(rating)
              ? 'fill-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]'
              : 'text-[color:var(--color-myntra-border)]'
          }`}
        />
      ))}
    </div>
  );
};

interface RatingPickerProps {
  value: number;
  onChange: (n: 1 | 2 | 3 | 4 | 5) => void;
  disabled?: boolean;
}

const RatingPicker: React.FC<RatingPickerProps> = ({ value, onChange, disabled }) => {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value;
  return (
    <div className="inline-flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {([1, 2, 3, 4, 5] as const).map(n => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          disabled={disabled}
          className="p-0.5"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              n <= active
                ? 'fill-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]'
                : 'text-[color:var(--color-myntra-border)]'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const ReviewsSection: React.FC<ReviewsSectionProps> = ({ fabricId }) => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const [approved, setApproved] = useState<Review[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(REVIEWS_PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    setVisibleCount(REVIEWS_PAGE_SIZE);
    (async () => {
      try {
        const rows = (await reviewsApi.forProduct(fabricId)) as unknown as Review[];
        if (!cancelled) {
          const sorted = [...rows].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setApproved(sorted);
        }
      } catch {
        if (!cancelled) setApproved([]);
      }
    })();
    return () => { cancelled = true; };
  }, [fabricId, reloadKey]);

  const summary = useMemo(() => {
    const total = approved.length;
    if (total === 0) {
      return {
        total,
        average: 0,
        breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>
      };
    }
    const sum = approved.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / total;
    const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of approved) breakdown[r.rating]++;
    return { total, average, breakdown };
  }, [approved]);

  const resetForm = () => {
    setRating(5);
    setTitle('');
    setBody('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSuccess(null);

    const trimmedBody = body.trim();
    if (trimmedBody.length < 10) {
      setError('Review must be at least 10 characters.');
      return;
    }
    if (trimmedBody.length > 1000) {
      setError('Review cannot exceed 1000 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await reviewsApi.create({
        fabricId,
        authorName: user.fullName,
        rating,
        title: title.trim() ? title.trim() : undefined,
        body: trimmedBody
      });
      setSuccess('Review submitted — pending moderation.');
      resetForm();
      setReloadKey(k => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const visible = approved.slice(0, visibleCount);
  const hasMore = visibleCount < approved.length;

  return (
    <section className="mt-12 md:mt-16">
      <h2 className="text-xl md:text-2xl font-extrabold mb-5 text-[color:var(--color-myntra-navy)]">
        Ratings & Reviews
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 lg:gap-10">
        {/* Summary */}
        <div className="border border-[color:var(--color-myntra-border-soft)] rounded p-5 self-start">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[40px] font-extrabold leading-none text-[color:var(--color-myntra-navy)]">
              {summary.total === 0 ? '—' : summary.average.toFixed(1)}
            </span>
            <span className="text-[14px] text-[color:var(--color-myntra-ink-soft)]">/5</span>
          </div>
          <Stars rating={summary.average} size="md" />
          <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-1">
            {summary.total === 0
              ? 'No reviews yet'
              : `${summary.total.toLocaleString('en-IN')} verified review${summary.total === 1 ? '' : 's'}`}
          </p>

          {summary.total > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              {([5, 4, 3, 2, 1] as const).map(star => {
                const count = summary.breakdown[star];
                const pct = summary.total === 0 ? 0 : (count / summary.total) * 100;
                return (
                  <div key={star} className="flex items-center gap-2 text-[12px]">
                    <span className="w-6 inline-flex items-center gap-0.5 text-[color:var(--color-myntra-ink-soft)] font-semibold">
                      {star}
                      <Star className="w-3 h-3 fill-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]" />
                    </span>
                    <div className="flex-1 h-1.5 bg-[color:var(--color-myntra-bg-soft)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[color:var(--color-myntra-pink)] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-[color:var(--color-myntra-ink-soft)]">
                      {Math.round(pct)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: write a review + list */}
        <div>
          {/* Write a review */}
          <div className="border border-[color:var(--color-myntra-border-soft)] rounded p-4 md:p-5 mb-6">
            <p className="text-[13px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-3">
              Write a review
            </p>

            {!user ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
                  Sign in to share your thoughts on this weave.
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'login' })}
                  className="btn-primary self-start sm:self-auto"
                >
                  Sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] block mb-1.5">
                    Your rating
                  </label>
                  <RatingPicker value={rating} onChange={setRating} disabled={submitting} />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] block mb-1.5">
                    Title (optional)
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Sum it up in a few words"
                    maxLength={120}
                    className="input-box w-full"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] block mb-1.5">
                    Your review
                  </label>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="How does the fabric feel? Did it match the description?"
                    rows={4}
                    minLength={10}
                    maxLength={1000}
                    required
                    className="input-box w-full resize-y"
                    disabled={submitting}
                  />
                  <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-1">
                    {body.trim().length}/1000 — minimum 10 characters
                  </p>
                </div>

                {error && (
                  <p className="text-[12px] font-semibold text-[color:var(--color-myntra-pink)]">{error}</p>
                )}
                {success && (
                  <p className="text-[12px] font-semibold text-[color:var(--color-myntra-green)]">{success}</p>
                )}

                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="btn-primary">
                    {submitting ? 'Submitting…' : 'Submit review'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Reviews list */}
          {approved.length === 0 ? (
            <div className="border border-dashed border-[color:var(--color-myntra-border)] rounded p-8 text-center">
              <MessageSquare className="w-8 h-8 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-2" />
              <p className="text-[14px] font-bold text-[color:var(--color-myntra-navy)]">
                Be the first to review this weave.
              </p>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-1">
                Your insights help other heirloom-hunters choose with confidence.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-[color:var(--color-myntra-border-soft)]">
              {visible.map(r => {
                return (
                  <li key={r.id} className="py-4 first:pt-0">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[color:var(--color-myntra-bg-soft)] flex items-center justify-center text-[12px] font-extrabold text-[color:var(--color-myntra-navy)] shrink-0">
                        {initialsOf(r.authorName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-bold text-[color:var(--color-myntra-navy)]">
                            {r.authorName}
                          </span>
                          <span className="text-[11px] text-[color:var(--color-myntra-ink-mute)]">
                            {formatDate(r.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <Stars rating={r.rating} />
                        </div>
                        {r.title && (
                          <p className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] mt-2">
                            {r.title}
                          </p>
                        )}
                        <p className="text-[13px] text-[color:var(--color-myntra-ink)] leading-relaxed mt-1 whitespace-pre-line">
                          {r.body}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {hasMore && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount(c => c + REVIEWS_PAGE_SIZE)}
                className="btn-outline"
              >
                Load more reviews
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
