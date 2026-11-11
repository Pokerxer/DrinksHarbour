'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useAuth } from '@/context/AuthContext';
import RatingStars from './RatingStars';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

interface StoreReview {
  _id: string;
  rating: number;
  title: string | null;
  comment: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  reviewer: { firstName: string | null; lastNameInitial: string | null };
}

const REVIEW_MIN_CHARS = 10;

// ─── Submit form (verified-purchase customers only) ──────────────────────────

function ReviewForm({ slug, onSubmitted }: { slug: string; onSubmitted: () => void }) {
  const { user, isAuthenticated } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  if (!isAuthenticated || !user) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <Icon.PiUserCircle size={18} className="mr-1.5 inline text-gray-400" aria-hidden="true" />
        <Link href="/login" className="font-semibold text-red-700 underline underline-offset-2">Sign in</Link>
        {' '}to rate this store — only customers with a delivered order from it can leave a review.
      </div>
    );
  }

  const submit = async () => {
    if (!rating || comment.trim().length < REVIEW_MIN_CHARS || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/stores/${slug}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, title: title.trim() || undefined, comment: comment.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setMessage({ tone: 'ok', text: data.message || 'Thank you! Your review will appear after moderation.' });
        setRating(0); setTitle(''); setComment('');
        onSubmitted();
      } else {
        setMessage({ tone: 'error', text: data.message || 'Could not submit your review. Please try again.' });
      }
    } catch {
      setMessage({ tone: 'error', text: 'Could not submit your review. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h4 className="text-sm font-bold text-gray-900">Rate this store</h4>
      <p className="mt-1 text-xs text-gray-500">
        Verified-purchase reviews only — you can rate a store after an order from it has been delivered.
      </p>

      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(0)}
            onClick={() => setRating(star)}
            className="p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700 rounded"
          >
            {(hover || rating) >= star
              ? <Icon.PiStarFill size={22} className="text-amber-500" aria-hidden="true" />
              : <Icon.PiStar size={22} className="text-gray-300 hover:text-amber-400" aria-hidden="true" />}
          </button>
        ))}
        {rating > 0 && <span className="ml-2 text-xs font-semibold text-gray-600">{rating} / 5</span>}
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="Headline (optional)"
        className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
      />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1200}
        rows={3}
        placeholder={`What was buying from this store like? (min ${REVIEW_MIN_CHARS} characters)`}
        className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
      />

      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs ${message.tone === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
          {message.text}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!rating || comment.trim().length < REVIEW_MIN_CHARS || submitting}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-red-700 to-red-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-red-800 hover:to-red-950 disabled:opacity-40"
      >
        {submitting ? 'Submitting…' : <><Icon.PiPaperPlaneTilt size={14} aria-hidden="true" /> Submit review</>}
      </button>
    </div>
  );
}

// ─── One review row ──────────────────────────────────────────────────────────

function ReviewRow({ review }: { review: StoreReview }) {
  const reviewer = [review.reviewer.firstName, review.reviewer.lastNameInitial]
    .filter(Boolean).join(' ') || 'DrinksHarbour customer';
  return (
    <li className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <RatingStars value={review.rating} size={13} />
        <span className="text-xs font-bold text-gray-900">{reviewer}</span>
        {review.isVerifiedPurchase && (
          <span className="flex items-center gap-1 text-[10px] font-medium bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">
            <Icon.PiSealCheck size={10} aria-hidden="true" /> Verified purchase
          </span>
        )}
        <span className="ml-auto text-[10px] text-gray-400">
          {new Date(review.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      {review.title && <p className="mt-2 text-sm font-semibold text-gray-800">{review.title}</p>}
      <p className="mt-1 text-sm text-gray-600 leading-relaxed">{review.comment}</p>
    </li>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function StoreReviews({ slug }: { slug: string }) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/stores/${slug}/reviews`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Could not load reviews');
      setSummary(data.data.summary);
      setReviews(data.data.reviews || []);
    } catch {
      setError('Could not load reviews right now.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="mb-10" aria-label="Customer reviews of this store">
      <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
        <Icon.PiChatsCircle size={18} className="text-red-700" aria-hidden="true" />
        Customer reviews
        {summary && summary.totalReviews > 0 && (
          <span className="text-xs font-normal text-gray-400">({summary.totalReviews})</span>
        )}
      </h2>

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-gray-200 rounded-xl" />
          <div className="h-24 bg-gray-100 rounded-xl" />
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <>
          <ReviewForm slug={slug} onSubmitted={load} />

          {summary && summary.totalReviews > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-white border border-gray-100 p-4">
              <p className="text-3xl font-black text-gray-900">{summary.averageRating.toFixed(1)}</p>
              <div>
                <RatingStars value={summary.averageRating} size={15} />
                <p className="text-xs text-gray-500 mt-0.5">
                  {summary.totalReviews} verified review{summary.totalReviews !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {reviews.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {reviews.map((review) => <ReviewRow key={review._id} review={review} />)}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-500">
              No published reviews yet — be the first to rate this store after your order arrives.
            </p>
          )}
        </>
      )}
    </section>
  );
}
