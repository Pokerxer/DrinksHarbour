'use client';

/**
 * Budget + schedule fields for the campaign form.
 *
 * The per-click tariff (and therefore the budget minimum) is server data from
 * GET /api/ads/campaigns/summary (`cpcTariff`) — the copy never hard-codes a
 * rate and never calls it a "market rate"; it is a platform pricing decision
 * surfaced verbatim.
 */

const naira = (value: number) => `₦${value.toLocaleString('en-NG')}`;

export default function CampaignBudgetFields({
  dailyBudget,
  onBudgetChange,
  startsAt,
  onStartsAtChange,
  endsAt,
  onEndsAtChange,
  cpcTariff,
}: {
  dailyBudget: string;
  onBudgetChange: (value: string) => void;
  startsAt: string;
  onStartsAtChange: (value: string) => void;
  endsAt: string;
  onEndsAtChange: (value: string) => void;
  cpcTariff: number | null;
}) {
  const budgetValue = dailyBudget.trim() === '' ? NaN : Number(dailyBudget);
  const budgetTooLow =
    Number.isInteger(budgetValue) && cpcTariff !== null && budgetValue < cpcTariff;

  const inputClasses =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-[#b20202] focus:ring-2 focus:ring-[#b20202]/20';

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="daily-budget"
          className="mb-1.5 block text-xs font-medium text-gray-700"
        >
          Daily budget (₦)
        </label>
        <input
          id="daily-budget"
          type="number"
          min={1}
          step={1}
          value={dailyBudget}
          onChange={(e) => onBudgetChange(e.target.value)}
          placeholder="1000"
          className={inputClasses}
        />
        {budgetTooLow && cpcTariff !== null ? (
          <p className="mt-1.5 text-xs font-medium text-red-600">
            Daily budget must be at least {naira(cpcTariff)} — that is the
            per-click rate.
          </p>
        ) : (
          cpcTariff !== null && (
            <p className="mt-1.5 text-xs text-gray-500">
              Charged {naira(cpcTariff)} per verified click.
            </p>
          )
        )}
      </div>

      <div>
        <label
          htmlFor="starts-at"
          className="mb-1.5 block text-xs font-medium text-gray-700"
        >
          Starts on (optional)
        </label>
        <input
          id="starts-at"
          type="date"
          value={startsAt}
          onChange={(e) => onStartsAtChange(e.target.value)}
          className={inputClasses}
        />
      </div>

      <div>
        <label
          htmlFor="ends-at"
          className="mb-1.5 block text-xs font-medium text-gray-700"
        >
          Ends on (optional)
        </label>
        <input
          id="ends-at"
          type="date"
          value={endsAt}
          onChange={(e) => onEndsAtChange(e.target.value)}
          className={inputClasses}
        />
      </div>
    </div>
  );
}
