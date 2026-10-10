'use client';
import { useEffect, useState } from 'react';
import type { PromotionSuggestionPlan } from '@/services/promotionSuggestions.service';
import NotificationProductControls from '../notification-product-controls';
import PromotionCard from './promotion-card';
import PromotionModal from './promotion-modal';
import { selectPromotions } from './promotion-rules';
import NotificationSummaryCards from '../notification-summary-cards';
export default function PromotionResults({
  plan,
}: {
  plan: PromotionSuggestionPlan;
}) {
  const [query, setQuery] = useState(''),
    [type, setType] = useState('all'),
    [confidence, setConfidence] = useState('all'),
    [sort, setSort] = useState('opportunity'),
    [page, setPage] = useState(1),
    [selectedId, setSelected] = useState<string | null>(null);
  const [metric, setMetric] = useState(''),
    [reviewOnly, setReview] = useState(false);
  const filtered = selectPromotions(
    plan.suggestions,
    query,
    type,
    confidence,
    sort
  ).filter((s) => !reviewOnly || s.pricing.offerPrice === null);
  const pages = Math.max(1, Math.ceil(filtered.length / 20)),
    activePage = Math.min(page, pages);
  const selected = plan.suggestions.find((s) => s.key === selectedId);
  useEffect(() => {
    setSelected(null);
    setPage(1);
  }, [query, type, confidence, sort]);
  useEffect(() => {
    if (selectedId && !selected) setSelected(null);
  }, [selectedId, selected]);
  return (
    <div className="space-y-4">
      <NotificationSummaryCards
        active={metric}
        onSelect={(value) => {
          setMetric(value);
          setType(
            value === 'review' ? 'all' : value === 'slow' ? 'offers' : value
          );
          setReview(value === 'review');
          setConfidence('all');
          setQuery('');
          setPage(1);
          setSelected(null);
        }}
        cards={[
          {
            valueId: 'combo',
            label: 'Supported combos',
            value: plan.suggestions.filter((s) => s.type === 'combo').length,
            detail: 'Learned from shared customer baskets',
          },
          {
            valueId: 'slow',
            label: 'Slow-mover opportunities',
            value: plan.suggestions.filter((s) => s.type !== 'combo').length,
            detail: 'Exploratory offers · review required',
          },
          {
            valueId: 'occasion',
            label: 'Upcoming occasions',
            value: plan.occasions.length,
            detail: 'Within the next 60 days',
          },
          {
            valueId: 'review',
            label: 'Pricing review needed',
            value: plan.suggestions.filter((s) => s.pricing.offerPrice === null)
              .length,
            detail: 'Missing terms, conflicts or permission',
          },
        ]}
      />
      <NotificationProductControls
        query={query}
        setQuery={setQuery}
        status={type}
        setStatus={(value) => {
          setType(value);
          setMetric('');
          setReview(false);
        }}
        statuses={[
          ['all', 'All suggestions'],
          ['combo', 'Sales-based combos'],
          ['occasion', 'Special-day offers'],
          ['slow_mover', 'Slow movers'],
          ['offers', 'All exploratory offers'],
        ]}
        sort={sort}
        setSort={setSort}
        sorts={[
          ['opportunity', 'Opportunity'],
          ['evidence', 'Strongest basket evidence'],
          ['movement', 'Most sold in timeframe'],
          ['occasion', 'Upcoming occasion'],
        ]}
        count={filtered.length}
        reset={() => {
          setQuery('');
          setType('all');
          setConfidence('all');
          setSort('opportunity');
          setPage(1);
          setMetric('');
          setReview(false);
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          Evidence
          <select
            aria-label="Evidence confidence"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            className="h-11 rounded-xl border px-3 text-sm font-normal"
          >
            <option value="all">All evidence</option>
            <option value="strong">Strong</option>
            <option value="emerging">Emerging</option>
            <option value="review">Review required</option>
          </select>
        </label>
      </NotificationProductControls>
      {filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.slice((activePage - 1) * 20, activePage * 20).map((s) => (
            <PromotionCard
              key={s.key}
              suggestion={s}
              open={() => setSelected(s.key)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <p className="font-semibold">No suggestions match your filters</p>
          <p className="mt-2 text-sm text-gray-500">
            Try a wider sales timeframe or another location. Learned combos need
            at least 10 eligible baskets, three shared baskets and supported
            affinity.
          </p>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-4 text-sm">
          <button
            disabled={activePage === 1}
            onClick={() => {
              setSelected(null);
              setPage(activePage - 1);
            }}
            className="disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {activePage} of {pages}
          </span>
          <button
            disabled={activePage >= pages}
            onClick={() => {
              setSelected(null);
              setPage(activePage + 1);
            }}
            className="disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
      {selected && (
        <PromotionModal
          key={selected.key}
          suggestion={selected}
          close={() => setSelected(null)}
        />
      )}
    </div>
  );
}
