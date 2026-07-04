'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const MAX_IMAGES = 5;
const MAX_IMAGE_MB = 8;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewImage { url: string; publicId?: string; alt?: string }

interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  sizeName?: string;
  images?: ReviewImage[];
  user: { firstName?: string; lastName?: string; _id: string };
}

interface Summary {
  averageRating: number;
  totalReviews: number;
  distribution: Record<string, number>;
}

interface PurchasedSize {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  subproductId?: string;
  sizeId?: string;
  sizeName?: string;
}

interface Eligibility {
  canReview: boolean;
  reason: 'eligible' | 'not_purchased' | 'already_reviewed' | 'unauthenticated';
  purchasedSizes?: PurchasedSize[];
  existingReview?: { _id: string; rating: number; status: string; sizeName?: string; createdAt: string };
}

interface LocalImage { file: File; preview: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s}>
          {s <= full
            ? <Icon.PiStarFill    size={size} className="text-amber-400" />
            : s === full + 1 && half
              ? <Icon.PiStarHalfFill size={size} className="text-amber-400" />
              : <Icon.PiStar      size={size} className="text-gray-200" />}
        </span>
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s} type="button"
            onClick={() => onChange(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className="focus:outline-none p-0.5"
            aria-label={`Rate ${s} star${s !== 1 ? 's' : ''}`}
          >
            <Icon.PiStarFill
              size={32}
              className={`transition-colors duration-100 ${s <= (hover || value) ? 'text-amber-400' : 'text-gray-200'}`}
            />
          </button>
        ))}
      </div>
      {(hover || value) > 0 && (
        <span className="text-sm font-semibold text-amber-600">{LABELS[hover || value]}</span>
      )}
    </div>
  );
}

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('dh_token') || sessionStorage.getItem('dh_token') || '';
}

function getUserId() {
  if (typeof window === 'undefined') return '';
  try {
    const u = localStorage.getItem('dh_user') || sessionStorage.getItem('dh_user') || '';
    return u ? JSON.parse(u)?._id || '' : '';
  } catch { return ''; }
}

// ─── Image upload zone ────────────────────────────────────────────────────────

function ImageUploadZone({
  images, onChange,
}: {
  images: LocalImage[];
  onChange: (imgs: LocalImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const valid: LocalImage[] = [];
    Array.from(files).slice(0, MAX_IMAGES - images.length).forEach(f => {
      if (!f.type.startsWith('image/')) return;
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) return;
      valid.push({ file: f, preview: URL.createObjectURL(f) });
    });
    if (valid.length) onChange([...images, ...valid]);
  };

  const remove = (i: number) => {
    URL.revokeObjectURL(images[i].preview);
    onChange(images.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-600 block">
        Photos <span className="text-gray-400 font-normal">(optional — up to {MAX_IMAGES}, max {MAX_IMAGE_MB}MB each)</span>
      </label>

      <div className="flex flex-wrap gap-2">
        {/* Existing previews */}
        {images.map((img, i) => (
          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group flex-shrink-0">
            <img src={img.preview} alt="Review image preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              aria-label="Remove image"
            >
              <Icon.PiXBold size={16} className="text-white" />
            </button>
          </div>
        ))}

        {/* Add button */}
        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className={`w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs transition-colors flex-shrink-0 ${
              dragOver ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <Icon.PiCameraBold size={20} className="text-gray-400" />
            <span className="text-gray-400 text-[10px]">Add photo</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={e => addFiles(e.target.files)}
      />
    </div>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({ r }: { r: Review }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [helpful, setHelpful]   = useState(r.helpfulCount);
  const [voted, setVoted]       = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);

  const name     = [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || 'Customer';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const date     = new Date(r.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  const markHelpful = async () => {
    if (voteLoading) return;
    const token = getToken();
    if (!token) return; // silently ignore if not logged in

    // Optimistic update
    const wasVoted = voted;
    setVoted(!wasVoted);
    setHelpful(h => wasVoted ? Math.max(0, h - 1) : h + 1);
    setVoteLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/products/reviews/${r._id}/helpful`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setHelpful(data.data.helpfulCount);
        setVoted(data.data.voted);
      } else {
        // Revert on failure
        setVoted(wasVoted);
        setHelpful(h => wasVoted ? h + 1 : Math.max(0, h - 1));
      }
    } catch {
      // Revert on error
      setVoted(wasVoted);
      setHelpful(h => wasVoted ? h + 1 : Math.max(0, h - 1));
    } finally {
      setVoteLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-100 to-red-200 text-red-700 flex items-center justify-center text-xs font-black flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">{name}</p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <Stars rating={r.rating} size={12} />
              {r.isVerifiedPurchase && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-600">
                  <Icon.PiCheckCircleFill size={10} /> Verified Purchase
                </span>
              )}
              {r.sizeName && (
                <span className="inline-flex items-center gap-0.5 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">
                  <Icon.PiWine size={9} /> {r.sizeName}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{date}</span>
      </div>

      {/* Body */}
      {r.title && <p className="font-bold text-gray-900 text-sm">{r.title}</p>}
      <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>

      {/* Review images */}
      {r.images && r.images.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {r.images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(i)}
              className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all flex-shrink-0"
            >
              <img src={img.url} alt={img.alt || `Review photo ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-4 pt-1 border-t border-gray-50">
        <button
          type="button"
          onClick={markHelpful}
          disabled={voteLoading}
          className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
            voted ? 'text-green-600 font-semibold' : 'text-gray-400 hover:text-gray-700'
          } disabled:opacity-60`}
        >
          {voteLoading
            ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            : <Icon.PiThumbsUpBold size={13} />}
          {voted ? 'Helpful!' : 'Helpful'}
          {helpful > 0 && <span className={voted ? 'text-green-500' : 'text-gray-400'}>({helpful})</span>}
        </button>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && r.images && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-2xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={r.images[lightbox].url}
                alt="Enlarged review image"
                className="w-full max-h-[80vh] object-contain rounded-2xl"
              />
              {r.images.length > 1 && (
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => setLightbox(l => (l! > 0 ? l! - 1 : r.images!.length - 1))}
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center"
                  >
                    <Icon.PiCaretLeftBold size={14} className="text-white" />
                  </button>
                  <span className="text-white/70 text-xs">{lightbox + 1} / {r.images.length}</span>
                  <button
                    type="button"
                    onClick={() => setLightbox(l => (l! < r.images!.length - 1 ? l! + 1 : 0))}
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center"
                  >
                    <Icon.PiCaretRightBold size={14} className="text-white" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg"
              >
                <Icon.PiXBold size={14} className="text-gray-700" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Review form ──────────────────────────────────────────────────────────────

function ReviewForm({
  productId,
  purchasedSizes,
  onSubmitted,
  onCancel,
}: {
  productId: string;
  purchasedSizes: PurchasedSize[];
  onSubmitted: () => void;
  onCancel: () => void;
}) {
  const [selectedSize, setSelectedSize] = useState<PurchasedSize | null>(
    purchasedSizes.length === 1 ? purchasedSizes[0] : null
  );
  const [rating,    setRating]    = useState(0);
  const [title,     setTitle]     = useState('');
  const [comment,   setComment]   = useState('');
  const [images,    setImages]    = useState<LocalImage[]>([]);
  const [error,     setError]     = useState('');
  const [submitting,setSubmitting]= useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedSize && purchasedSizes.length > 1) {
      setError('Please select which size you are reviewing'); return;
    }
    if (rating === 0) { setError('Please select a star rating'); return; }
    if (comment.trim().length < 10) { setError('Review must be at least 10 characters'); return; }

    const size = selectedSize ?? purchasedSizes[0];
    const fd   = new FormData();
    fd.append('rating',  String(rating));
    fd.append('comment', comment.trim());
    if (title.trim())         fd.append('title',        title.trim());
    if (size?.orderId)        fd.append('orderId',       size.orderId);
    if (size?.subproductId)   fd.append('subproductId',  size.subproductId);
    if (size?.sizeId)         fd.append('sizeId',        size.sizeId);
    if (size?.sizeName)       fd.append('sizeName',      size.sizeName);
    images.forEach(img => fd.append('images', img.file));

    setSubmitting(true);
    try {
      const res  = await fetch(`${API_URL}/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed');
      onSubmitted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-gray-900">Write Your Review</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
          <Icon.PiXBold size={18} />
        </button>
      </div>

      {/* Size selector — only shown when multiple sizes were purchased */}
      {purchasedSizes.length > 1 && (
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-2 block">
            Which size are you reviewing? <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {purchasedSizes.map((ps, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedSize(ps)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                  selectedSize?.sizeId === ps.sizeId
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                <Icon.PiWine size={14} />
                {ps.sizeName || 'Standard'}
                <span className="text-[10px] font-normal opacity-60">#{ps.orderNumber}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Single size — just show as context */}
      {purchasedSizes.length === 1 && purchasedSizes[0].sizeName && (
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
          <Icon.PiShoppingBagBold size={14} className="text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">
            Reviewing <strong className="text-gray-700">{purchasedSizes[0].sizeName}</strong>
            {' '}— Order <strong className="text-gray-700">#{purchasedSizes[0].orderNumber}</strong>
          </span>
        </div>
      )}

      {/* Star rating */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-2 block">
          Overall Rating <span className="text-red-500">*</span>
        </label>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
          Review Title <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Smooth and complex, great value"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all"
        />
      </div>

      {/* Comment */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
          Your Review <span className="text-red-500">*</span>
        </label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={1200}
          rows={4}
          placeholder="Share tasting notes, how you enjoyed it, occasions, value for money…"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all resize-none"
        />
        <p className="text-right text-xs text-gray-400 mt-1">{comment.length}/1200</p>
      </div>

      {/* Image upload */}
      <ImageUploadZone images={images} onChange={setImages} />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <Icon.PiWarningCircleBold size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 px-4 py-2.5 bg-gradient-to-br from-red-700 to-red-900 text-white font-bold rounded-xl text-sm hover:from-red-800 hover:to-red-950 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
          ) : (
            <><Icon.PiPaperPlaneTiltBold size={14} /> Submit Review</>
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProductReviews({ productId }: { productId: string }) {
  const [reviews,     setReviews]     = useState<Review[]>([]);
  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterStar,  setFilterStar]  = useState(0);   // 0 = all
  const [sortBy,      setSortBy]      = useState<'helpful' | 'recent'>('helpful');

  const [eligibility,      setEligibility]      = useState<Eligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [showForm,         setShowForm]         = useState(false);
  const [submitted,        setSubmitted]        = useState(false);

  const token    = typeof window !== 'undefined' ? getToken()   : '';
  const isLoggedIn = Boolean(token);

  // ── Fetch reviews ──────────────────────────────────────────────────────────
  const fetchReviews = useCallback(async (p = 1, append = false) => {
    try {
      const params = new URLSearchParams({
        page:  String(p),
        limit: '8',
        sort:  sortBy,
      });
      if (filterStar > 0) params.set('rating', String(filterStar));

      const res  = await fetch(`${API_URL}/api/products/${productId}/reviews?${params}`);
      const data = await res.json();
      if (!data.success) return;

      const incoming: Review[] = data.data?.reviews ?? data.data?.data ?? [];
      setReviews(prev => append ? [...prev, ...incoming] : incoming);
      setHasMore(incoming.length === 8);
      if (p === 1) {
        const s = data.data?.summary ?? data.data?.meta;
        if (s) setSummary(s);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [productId, sortBy, filterStar]);

  useEffect(() => {
    if (productId) { setLoading(true); setPage(1); fetchReviews(1); }
  }, [productId, fetchReviews]);

  // ── Fetch eligibility once user is known to be logged in ──────────────────
  useEffect(() => {
    if (!isLoggedIn || !productId) return;
    setEligibilityLoading(true);
    fetch(`${API_URL}/api/products/${productId}/reviews/eligibility`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setEligibility(data.data);
      })
      .catch(() => {})
      .finally(() => setEligibilityLoading(false));
  }, [productId, isLoggedIn, token]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    setLoadingMore(true);
    fetchReviews(next, true);
  };

  const onSubmitted = () => {
    setSubmitted(true);
    setShowForm(false);
    // Refresh eligibility to show "already reviewed"
    setEligibility(prev => prev ? { ...prev, canReview: false, reason: 'already_reviewed' } : prev);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-7 bg-gray-100 rounded-lg w-48" />
          <div className="grid sm:grid-cols-5 gap-6">
            <div className="sm:col-span-2 h-48 bg-gray-100 rounded-2xl" />
            <div className="sm:col-span-3 space-y-3">
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-10 bg-gray-100 rounded-xl w-36" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const avg   = summary?.averageRating ?? 0;
  const total = summary?.totalReviews  ?? reviews.length;
  const dist  = summary?.distribution  ?? {};

  // ── CTA state ──────────────────────────────────────────────────────────────
  const renderCTA = () => {
    if (!isLoggedIn) {
      return (
        <a
          href="/login"
          className="self-start inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-semibold text-sm hover:border-red-200 hover:text-red-700 transition-all"
        >
          <Icon.PiUserBold size={15} /> Log in to review
        </a>
      );
    }

    if (eligibilityLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          Checking purchase history…
        </div>
      );
    }

    if (submitted || eligibility?.reason === 'already_reviewed') {
      const ev = eligibility?.existingReview;
      return (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl p-4">
          <Icon.PiCheckCircleBold size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-700">
            <p className="font-bold">Review submitted</p>
            <p className="text-xs mt-0.5 text-green-600">
              {submitted
                ? 'Thank you! It will appear after our team reviews it.'
                : `You reviewed this product${ev?.sizeName ? ` (${ev.sizeName})` : ''}. It's currently ${ev?.status ?? 'pending'} review.`}
            </p>
          </div>
        </div>
      );
    }

    if (eligibility?.reason === 'not_purchased') {
      return (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <Icon.PiShoppingBagBold size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Purchase required</p>
            <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
              Only customers who have purchased and received this product can leave a review.
            </p>
          </div>
        </div>
      );
    }

    if (eligibility?.canReview) {
      return (
        <button
          onClick={() => setShowForm(v => !v)}
          className="self-start inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md"
        >
          <Icon.PiPencilSimpleBold size={15} />
          {showForm ? 'Cancel Review' : 'Write a Review'}
        </button>
      );
    }

    return null;
  };

  return (
    <section className="container mx-auto px-4 py-12 max-w-4xl">
      <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-2">
        <Icon.PiStarFill size={20} className="text-amber-400" />
        Customer Reviews
        {total > 0 && <span className="text-base font-normal text-gray-400">({total})</span>}
      </h2>

      {/* ── Summary + CTA ─────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-5 gap-6 mb-8">

        {/* Summary card */}
        <div className="sm:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center text-center">
          <p className="text-5xl font-black text-gray-900 leading-none">
            {avg > 0 ? avg.toFixed(1) : '—'}
          </p>
          <div className="mt-2"><Stars rating={avg} size={18} /></div>
          <p className="text-xs text-gray-400 mt-1.5">
            {total > 0 ? `Based on ${total} review${total !== 1 ? 's' : ''}` : 'No reviews yet'}
          </p>

          {total > 0 && (
            <div className="w-full mt-4 space-y-1.5">
              {[5, 4, 3, 2, 1].map(star => {
                const count = dist[String(star)] ?? 0;
                const pct   = total > 0 ? (count / total) * 100 : 0;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFilterStar(filterStar === star ? 0 : star)}
                    className={`w-full flex items-center gap-2 text-xs group transition-opacity ${
                      filterStar > 0 && filterStar !== star ? 'opacity-40' : ''
                    }`}
                  >
                    <span className="w-3 text-right text-gray-500">{star}</span>
                    <Icon.PiStarFill size={10} className="text-amber-400 flex-shrink-0" />
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-5 text-right text-gray-400">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {filterStar > 0 && (
            <button
              type="button"
              onClick={() => setFilterStar(0)}
              className="mt-3 text-xs text-red-600 hover:underline flex items-center gap-1"
            >
              <Icon.PiXBold size={10} /> Clear filter
            </button>
          )}
        </div>

        {/* CTA panel */}
        <div className="sm:col-span-3 flex flex-col justify-center gap-4">
          <div>
            <h3 className="font-bold text-gray-900 mb-1">Share your experience</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Tried this product? Your review helps other customers make confident choices — and
              only verified buyers can post.
            </p>
          </div>
          {renderCTA()}
        </div>
      </div>

      {/* ── Review form ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && eligibility?.purchasedSizes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden mb-6"
          >
            <ReviewForm
              productId={productId}
              purchasedSizes={eligibility.purchasedSizes}
              onSubmitted={onSubmitted}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sort bar ──────────────────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {filterStar > 0
              ? `${reviews.length} ${filterStar}-star review${reviews.length !== 1 ? 's' : ''}`
              : `${total} review${total !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {(['helpful', 'recent'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { setSortBy(s); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  sortBy === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s === 'helpful' ? 'Most Helpful' : 'Most Recent'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Review list ───────────────────────────────────────────────────── */}
      {reviews.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-gray-100">
          <Icon.PiStarBold size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-semibold">
            {filterStar > 0 ? `No ${filterStar}-star reviews yet` : 'No reviews yet'}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {filterStar > 0 ? 'Try a different star filter.' : 'Be the first verified buyer to review this product.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => <ReviewCard key={r._id} r={r} />)}

          {hasMore && (
            <div className="text-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-semibold text-sm hover:border-red-200 hover:text-red-700 transition-all disabled:opacity-50"
              >
                {loadingMore
                  ? <><div className="w-4 h-4 border-2 border-gray-200 border-t-red-700 rounded-full animate-spin" /> Loading…</>
                  : <><Icon.PiArrowDownBold size={14} /> Load More Reviews</>}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
