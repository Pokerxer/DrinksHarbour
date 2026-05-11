'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  user: { firstName?: string; lastName?: string; _id: string };
}

interface Summary {
  averageRating: number;
  totalReviews: number;
  distribution: Record<string, number>; // { "5": 12, "4": 4, ... }
}

// ─── Star renderer ────────────────────────────────────────────────────────────

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Icon.PiStarFill
          key={s}
          size={size}
          className={s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}
        />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none"
          aria-label={`Rate ${s} star${s !== 1 ? 's' : ''}`}
        >
          <Icon.PiStarFill
            size={28}
            className={`transition-colors ${s <= (hover || value) ? 'text-amber-400' : 'text-gray-200'}`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews]       = useState<Review[]>([]);
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Form state
  const [showForm, setShowForm]     = useState(false);
  const [rating, setRating]         = useState(0);
  const [title, setTitle]           = useState('');
  const [comment, setComment]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted]   = useState(false);

  const isLoggedIn = typeof window !== 'undefined'
    ? !!(localStorage.getItem('token') || sessionStorage.getItem('token'))
    : false;

  const token = typeof window !== 'undefined'
    ? localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    : '';

  const fetchReviews = useCallback(async (p = 1, append = false) => {
    try {
      const res  = await fetch(`${API_URL}/api/products/${productId}/reviews?page=${p}&limit=5&sort=helpful`);
      const data = await res.json();
      if (!data.success) return;

      const incoming: Review[] = data.data?.reviews ?? data.data?.data ?? [];
      setReviews(prev => append ? [...prev, ...incoming] : incoming);
      setHasMore(incoming.length === 5);

      if (p === 1) {
        const s = data.data?.summary ?? data.data?.meta;
        if (s) setSummary(s);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) fetchReviews(1);
  }, [productId, fetchReviews]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    setLoadingMore(true);
    fetchReviews(next, true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (rating === 0) { setSubmitError('Please select a star rating'); return; }
    if (!comment.trim()) { setSubmitError('Please write a comment'); return; }

    setSubmitting(true);
    try {
      const res  = await fetch(`${API_URL}/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, title, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed');
      setSubmitted(true);
      setShowForm(false);
      setRating(0); setTitle(''); setComment('');
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const ratingLabel = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating] || '';

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="animate-pulse space-y-3 max-w-2xl">
          <div className="h-6 bg-gray-100 rounded w-40" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-3/4" />
        </div>
      </div>
    );
  }

  const avg   = summary?.averageRating ?? 0;
  const total = summary?.totalReviews  ?? reviews.length;
  const dist  = summary?.distribution  ?? {};

  return (
    <section className="container mx-auto px-4 py-12 max-w-4xl">
      <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-2">
        <Icon.PiStarFill size={20} className="text-amber-400" />
        Customer Reviews
      </h2>

      <div className="grid sm:grid-cols-5 gap-8 mb-10">
        {/* ── Summary card ───────────────────────────────────── */}
        <div className="sm:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center text-center">
          <p className="text-5xl font-black text-gray-900">{avg > 0 ? avg.toFixed(1) : '—'}</p>
          <Stars rating={avg} size={20} />
          <p className="text-xs text-gray-400 mt-2">
            {total > 0 ? `Based on ${total} review${total !== 1 ? 's' : ''}` : 'No reviews yet'}
          </p>

          {/* Distribution bars */}
          {total > 0 && (
            <div className="w-full mt-5 space-y-1.5">
              {[5, 4, 3, 2, 1].map(star => {
                const count = dist[String(star)] ?? 0;
                const pct   = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-3 text-right">{star}</span>
                    <Icon.PiStarFill size={11} className="text-amber-400 flex-shrink-0" />
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-4">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Write a review CTA ─────────────────────────────── */}
        <div className="sm:col-span-3 flex flex-col justify-center gap-4">
          <div>
            <h3 className="font-bold text-gray-900 mb-1">Share your experience</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Tried this product? Your review helps other customers make confident choices.
              Reviews are checked by our team before going live.
            </p>
          </div>

          {submitted ? (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl p-4">
              <Icon.PiCheckCircleBold size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-700">
                <p className="font-bold">Review submitted!</p>
                <p className="text-xs mt-0.5 text-green-600">Thank you. It will appear after moderation.</p>
              </div>
            </div>
          ) : isLoggedIn ? (
            <button
              onClick={() => setShowForm(v => !v)}
              className="self-start inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md"
            >
              <Icon.PiPencilSimpleBold size={15} />
              {showForm ? 'Cancel' : 'Write a Review'}
            </button>
          ) : (
            <a
              href="/login"
              className="self-start inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-semibold text-sm hover:border-red-200 hover:text-red-700 transition-all"
            >
              <Icon.PiUserBold size={15} /> Log in to review
            </a>
          )}
        </div>
      </div>

      {/* ── Review form ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-8"
          >
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
            >
              <h3 className="font-black text-gray-900 text-sm">Your Review</h3>

              {/* Star picker */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">
                  Overall Rating <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <StarPicker value={rating} onChange={setRating} />
                  {ratingLabel && (
                    <span className="text-sm font-semibold text-amber-600">{ratingLabel}</span>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Review Title <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Smooth and complex"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all"
                />
              </div>

              {/* Comment */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Review <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  maxLength={1200}
                  rows={4}
                  placeholder="What did you think of this product? Tasting notes, occasions, value for money…"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all resize-none"
                />
                <p className="text-right text-xs text-gray-400 mt-1">{comment.length}/1200</p>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <Icon.PiWarningCircleBold size={16} className="flex-shrink-0" />
                  {submitError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-br from-red-700 to-red-900 text-white font-bold rounded-xl text-sm hover:from-red-800 hover:to-red-950 disabled:opacity-50 transition-all"
                >
                  {submitting ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Review list ────────────────────────────────────────────────── */}
      {reviews.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <Icon.PiStarBold size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-semibold text-sm">No reviews yet</p>
          <p className="text-gray-400 text-xs mt-1">Be the first to review this product.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => {
            const name = [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || 'Customer';
            const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
            const date = new Date(r.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

            return (
              <div key={r._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-black flex-shrink-0">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Stars rating={r.rating} size={12} />
                        {r.isVerifiedPurchase && (
                          <span className="text-[10px] font-semibold text-green-600 flex items-center gap-0.5">
                            <Icon.PiCheckCircleFill size={10} /> Verified Purchase
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{date}</span>
                </div>

                {r.title && (
                  <p className="font-bold text-gray-900 text-sm mb-1">{r.title}</p>
                )}
                <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>

                {r.helpfulCount > 0 && (
                  <p className="text-xs text-gray-400 mt-3">
                    {r.helpfulCount} person{r.helpfulCount !== 1 ? 's' : ''} found this helpful
                  </p>
                )}
              </div>
            );
          })}

          {hasMore && (
            <div className="text-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-semibold text-sm hover:border-red-200 hover:text-red-700 transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <><div className="w-4 h-4 border-2 border-gray-200 border-t-red-700 rounded-full animate-spin" /> Loading…</>
                ) : (
                  <><Icon.PiArrowDownBold size={14} /> Load More Reviews</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
