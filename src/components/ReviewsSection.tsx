import React, { useEffect, useMemo, useState } from 'react';
import { Star, MessageSquare, ShieldCheck, Upload, X, Loader2 } from 'lucide-react';
import type { Review } from '../types';
import { reviewsApi } from '../lib/firebase';
import { compressImage, GALLERY_PHOTO_BUDGET } from '../lib/compressImage';
import ImageViewer from './ImageViewer';
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

  const [approved, setApproved] = useState<Review[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(REVIEWS_PAGE_SIZE);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  // Which delivered order of this shopper's contains the piece. null = they
  // have not bought it, undefined = we have not checked yet.
  const [purchase, setPurchase] = useState<{ orderId: string } | null | undefined>(undefined);
  // Photographs a customer attached, opened full screen.
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number; alt: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVisibleCount(REVIEWS_PAGE_SIZE);
    setApproved(null);
    setFetchError(null);
    (async () => {
      try {
        const rows = (await reviewsApi.forProduct(fabricId)) as unknown as Review[];
        if (!cancelled) {
          const sorted = [...rows].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setApproved(sorted);
        }
      } catch (err) {
        if (!cancelled) {
          setApproved([]);
          setFetchError(err instanceof Error ? err.message : 'Could not load reviews.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [fabricId, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setPurchase(undefined);
    if (!user) { setPurchase(null); return; }
    (async () => {
      const hit = await reviewsApi.purchaseOf(fabricId).catch(() => null);
      if (!cancelled) setPurchase(hit);
    })();
    return () => { cancelled = true; };
  }, [fabricId, user]);

  const reviews = approved ?? [];
  const loading = approved === null;

  const summary = useMemo(() => {
    const total = reviews.length;
    if (total === 0) {
      return {
        total,
        average: 0,
        breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>
      };
    }
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / total;
    const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) breakdown[r.rating]++;
    return { total, average, breakdown };
  }, [reviews]);

  const resetForm = () => {
    setRating(5);
    setTitle('');
    setBody('');
    setPhotos([]);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setPhotoBusy(true);
    try {
      const room = 3 - photos.length;
      const chosen = Array.from(files).slice(0, Math.max(0, room));
      const shots = await Promise.all(chosen.map(f => compressImage(f, GALLERY_PHOTO_BUDGET)));
      setPhotos(p => [...p, ...shots].slice(0, 3));
    } catch {
      setError('That photo could not be read. Try another file.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSuccess(null);

    const trimmedBody = body.trim();
    if (trimmedBody.length < 4) {
      setError('Review must be at least 4 characters.');
      return;
    }
    if (trimmedBody.length > 1000) {
      setError('Review cannot exceed 1000 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (!purchase) {
        setError('Only customers who have received this piece can review it.');
        return;
      }
      await reviewsApi.create({
        fabricId,
        orderId: purchase.orderId,
        authorName: user.fullName,
        rating,
        title: title.trim() ? title.trim() : undefined,
        body: trimmedBody,
        photos,
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

  const visible = reviews.slice(0, visibleCount);
  const hasMore = visibleCount < reviews.length;

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
            ) : purchase === undefined ? (
              <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking your orders…
              </p>
            ) : purchase === null ? (
              /* Not a buyer. The form is hidden rather than disabled: offering
                 a control that cannot succeed reads as a broken page, and
                 firestore.rules would refuse the write regardless. */
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
                  Reviews come from customers who have received this piece. Once yours is
                  delivered, you can write one here.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--color-myntra-green)]">
                  <ShieldCheck className="w-4 h-4" /> Verified purchase
                </p>
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
                    minLength={4}
                    maxLength={1000}
                    required
                    className="input-box w-full resize-y"
                    disabled={submitting}
                  />
                  <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-1">
                    {body.trim().length}/1000 — minimum 4 characters
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] block mb-1.5">
                    Add photos (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((src, i) => (
                      <div key={i} className="relative w-16 h-20 rounded overflow-hidden border border-[color:var(--color-myntra-border-soft)]">
                        <img src={src} alt={`Your photo ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                          aria-label={`Remove photo ${i + 1}`}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white/95 border border-[color:var(--color-myntra-border-soft)] flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {photos.length < 3 && (
                      <label className="w-16 h-20 rounded border border-dashed border-[color:var(--color-myntra-border)] flex flex-col items-center justify-center gap-1 cursor-pointer text-[color:var(--color-myntra-ink-mute)] hover:bg-[color:var(--color-myntra-bg-soft)]">
                        {photoBusy
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><Upload className="w-4 h-4" /><span className="text-[9px] font-semibold">Photo</span></>}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          disabled={submitting || photoBusy}
                          aria-label="Add a photo to your review"
                          onChange={e => { void addPhotos(e.target.files); e.target.value = ''; }}
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-1">
                    Up to 3. Photos of the piece as it arrived help the next customer most.
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

          {/* Fetch error banner — never blanks the whole section */}
          {fetchError && (
            <div className="mb-4 border border-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-soft)] rounded p-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[12px] text-[color:var(--color-myntra-navy)] font-semibold">
                Couldn't load reviews. {fetchError}
              </p>
              <button
                type="button"
                onClick={() => setReloadKey(k => k + 1)}
                className="text-[12px] font-bold text-[color:var(--color-myntra-pink)] underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Reviews list */}
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-[color:var(--color-myntra-bg-soft)] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 bg-[color:var(--color-myntra-bg-soft)] rounded" />
                    <div className="h-3 w-full bg-[color:var(--color-myntra-bg-soft)] rounded" />
                    <div className="h-3 w-5/6 bg-[color:var(--color-myntra-bg-soft)] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="border border-dashed border-[color:var(--color-myntra-border)] rounded p-8 text-center">
              <MessageSquare className="w-8 h-8 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-2" />
              <p className="text-[14px] font-bold text-[color:var(--color-myntra-navy)]">
                Be the first to write about this weave.
              </p>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-1 mb-4">
                Your insights help other heirloom-hunters choose with confidence.
              </p>
              {!user && (
                <button
                  type="button"
                  onClick={() => navigate({ name: 'login' })}
                  className="btn-outline"
                >
                  Sign in to leave a review
                </button>
              )}
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
                          {/* Every review now carries the order it was written
                              against, so the badge states a fact the rules
                              enforced rather than a claim the page makes. */}
                          {r.orderId && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-green)]">
                              <ShieldCheck className="w-3 h-3" /> Verified purchase
                            </span>
                          )}
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
                        {/* A customer's own photographs are the most useful
                            thing on this page: they show the piece in a room,
                            not a studio. They open in the same full-screen
                            viewer the product gallery uses. */}
                        {r.photos && r.photos.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {r.photos.map((src, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setLightbox({ photos: r.photos!, index: i, alt: `Photo by ${r.authorName}` })}
                                aria-label={`Open photo ${i + 1} by ${r.authorName}`}
                                className="w-16 h-20 rounded overflow-hidden border border-[color:var(--color-myntra-border-soft)] cursor-zoom-in"
                              >
                                <img src={src} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
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

      {lightbox && (
        <ImageViewer
          photos={lightbox.photos.map(photo => ({ photo, fallback: photo }))}
          index={lightbox.index}
          alt={lightbox.alt}
          onIndex={i => setLightbox(l => (l ? { ...l, index: i } : l))}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
};

export default ReviewsSection;
