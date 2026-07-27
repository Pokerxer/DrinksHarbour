// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Text, Badge, Button, Select, Input, Avatar } from 'rizzui';
import {
  PiCheckBold,
  PiXBold,
  PiEyeSlashBold,
  PiTrashBold,
  PiStarFill,
  PiMagnifyingGlassBold,
  PiSealCheckFill,
  PiArrowsClockwiseBold,
  PiChatCenteredDotsBold,
} from 'react-icons/pi';
import { reviewService } from '@/services/review.service';

const STATUS_TABS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Hidden', value: 'hidden' },
  { label: 'All', value: '' },
];

const RATING_OPTIONS = [
  { label: 'All ratings', value: '' },
  { label: '5 stars', value: '5' },
  { label: '4 stars', value: '4' },
  { label: '3 stars', value: '3' },
  { label: '2 stars', value: '2' },
  { label: '1 star', value: '1' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  hidden: 'bg-gray-200 text-gray-700',
};

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <PiStarFill
          key={i}
          className={`h-4 w-4 ${
            i <= value
              ? 'fill-orange text-orange'
              : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
      <Text className="ms-1 text-sm font-medium text-gray-700">{value}.0</Text>
    </span>
  );
}

export default function ReviewsTable() {
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.token || session?.user?.token || '';

  const [reviews, setReviews] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('pending');
  const [rating, setRating] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState('');

  const fetchReviews = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await reviewService.getReviews(token, {
        status,
        rating,
        search,
        limit: '100',
      });
      setReviews(data.reviews || []);
      setCounts(data.counts || {});
    } catch (err: any) {
      setError(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [token, status, rating, search]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') fetchReviews();
  }, [sessionStatus, fetchReviews]);

  const moderate = async (review: any, next: string) => {
    setBusyId(review._id);
    try {
      await reviewService.setStatus(review._id, next, token);
      toast.success(`Review ${next}`);
      fetchReviews();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusyId('');
    }
  };

  const removeReview = async (review: any) => {
    setBusyId(review._id);
    try {
      await reviewService.deleteReview(review._id, token);
      toast.success('Review deleted');
      setConfirmDeleteId('');
      fetchReviews();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusyId('');
    }
  };

  const reviewerName = (r: any) =>
    r.user?.name ||
    [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') ||
    'Unknown customer';

  return (
    <div className="space-y-5">
      {/* Status tabs with live counts */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const count = tab.value === '' ? counts.all : counts[tab.value];
          const active = status === tab.value;
          return (
            <button
              key={tab.value || 'all'}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                active
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {count != null && (
                <span
                  className={`ms-2 rounded-full px-2 py-0.5 text-xs ${
                    active ? 'bg-white/20' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          className="ms-auto"
          onClick={fetchReviews}
          disabled={loading}
        >
          <PiArrowsClockwiseBold
            className={`me-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center">
        <Input
          className="@lg:max-w-xs"
          placeholder="Search title or comment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<PiMagnifyingGlassBold className="h-4 w-4 text-gray-500" />}
          clearable
          onClear={() => setSearch('')}
        />
        <Select
          className="@lg:max-w-[180px]"
          options={RATING_OPTIONS}
          value={rating}
          onChange={(v: any) => setRating(v?.value ?? v)}
          displayValue={(v: any) =>
            RATING_OPTIONS.find((o) => o.value === (v?.value ?? v))?.label ||
            'All ratings'
          }
        />
      </div>

      {/* Loading skeleton */}
      {(sessionStatus === 'loading' || loading) && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="h-12 w-12 flex-shrink-0 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-2/5 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-white p-10 text-center">
          <Text className="font-medium text-red-600">{error}</Text>
          <Button className="mt-4" variant="outline" onClick={fetchReviews}>
            Try again
          </Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && reviews.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-14 text-center">
          <PiChatCenteredDotsBold className="mx-auto h-10 w-10 text-gray-300" />
          <Text className="mt-3 font-medium text-gray-700">
            No {status || ''} reviews found
          </Text>
          <Text className="mt-1 text-sm text-gray-500">
            {status === 'pending'
              ? 'Nothing is waiting for moderation right now.'
              : 'Try a different filter.'}
          </Text>
        </div>
      )}

      {/* Review cards */}
      {!loading &&
        !error &&
        reviews.map((r: any) => (
          <div
            key={r._id}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 @2xl:flex-row">
              {/* Reviewer + content */}
              <div className="flex flex-1 gap-4">
                <Avatar name={reviewerName(r)} src={r.user?.avatar} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Text className="font-semibold text-gray-900">
                      {reviewerName(r)}
                    </Text>
                    {r.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        <PiSealCheckFill className="h-3.5 w-3.5" />
                        Verified purchase
                      </span>
                    )}
                    <Badge
                      className={`text-xs ${STATUS_COLORS[r.status] || ''}`}
                    >
                      {r.status}
                    </Badge>
                  </div>

                  <div className="mt-1.5">
                    <Stars value={r.rating} />
                  </div>

                  {r.title && (
                    <Text className="mt-2 font-medium text-gray-900">
                      {r.title}
                    </Text>
                  )}
                  <Text className="mt-1 leading-relaxed text-gray-600">
                    {r.comment}
                  </Text>

                  {Array.isArray(r.images) && r.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.images.map((img: any, i: number) => (
                        <div
                          key={i}
                          className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-100"
                        >
                          <Image
                            src={img.url}
                            alt={img.alt || 'Review image'}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <Text className="mt-2 text-xs text-gray-400">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                    {r.sizeName ? ` · ${r.sizeName}` : ''}
                  </Text>
                </div>
              </div>

              {/* Product */}
              <div className="flex w-full items-start gap-3 border-t border-gray-100 pt-4 @2xl:w-56 @2xl:border-s @2xl:border-t-0 @2xl:ps-4 @2xl:pt-0">
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-50">
                  {r.product?.images?.[0]?.url && (
                    <Image
                      src={r.product.images[0].url}
                      alt={r.product?.name || 'Product'}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <Text className="line-clamp-2 text-sm font-medium text-gray-900">
                    {r.product?.name || 'Unknown product'}
                  </Text>
                  {r.product?.reviewCount != null && (
                    <Text className="mt-0.5 text-xs text-gray-500">
                      {r.product.averageRating || 0}★ · {r.product.reviewCount}{' '}
                      reviews
                    </Text>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              {r.status !== 'approved' && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  isLoading={busyId === r._id}
                  onClick={() => moderate(r, 'approved')}
                >
                  <PiCheckBold className="me-1.5 h-4 w-4" />
                  Approve
                </Button>
              )}
              {r.status !== 'rejected' && (
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={busyId === r._id}
                  onClick={() => moderate(r, 'rejected')}
                >
                  <PiXBold className="me-1.5 h-4 w-4" />
                  Reject
                </Button>
              )}
              {r.status !== 'hidden' && (
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={busyId === r._id}
                  onClick={() => moderate(r, 'hidden')}
                >
                  <PiEyeSlashBold className="me-1.5 h-4 w-4" />
                  Hide
                </Button>
              )}

              {/* Two-click delete confirm — window.confirm blocks browser automation */}
              <div className="ms-auto">
                {confirmDeleteId === r._id ? (
                  <div className="flex items-center gap-2">
                    <Text className="text-sm text-gray-600">
                      Delete permanently?
                    </Text>
                    <Button
                      size="sm"
                      color="danger"
                      isLoading={busyId === r._id}
                      onClick={() => removeReview(r)}
                    >
                      Yes, delete
                    </Button>
                    <Button
                      size="sm"
                      variant="text"
                      onClick={() => setConfirmDeleteId('')}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="text"
                    className="text-red-600"
                    onClick={() => setConfirmDeleteId(r._id)}
                  >
                    <PiTrashBold className="me-1.5 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
