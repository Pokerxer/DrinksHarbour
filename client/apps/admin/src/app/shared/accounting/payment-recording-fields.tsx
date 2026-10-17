import type { PaymentMethod, PaymentSide } from '@/services/arAp.service';
import PaymentPartySelect from './payment-party-select';
const input =
  'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-600 focus:outline-none';
export interface PaymentFields {
  name: string;
  amount: string;
  method: PaymentMethod;
  reference: string;
  date: string;
  party: string;
}
export default function PaymentRecordingFields({
  token,
  side,
  value,
  change,
  partyChange,
  busy,
  chooseAccount = true,
}: {
  token: string;
  side: PaymentSide;
  value: PaymentFields;
  change: (value: Partial<PaymentFields>) => void;
  partyChange: (id: string, name: string) => void;
  busy: boolean;
  chooseAccount?: boolean;
}) {
  return (
    <fieldset
      disabled={busy}
      className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {chooseAccount && (
        <PaymentPartySelect
          token={token}
          side={side}
          value={value.party}
          name={value.name}
          busy={busy}
          change={partyChange}
        />
      )}
      <label className="block text-xs font-medium text-gray-600">
        {side === 'customer' ? 'Customer name' : 'Vendor name'}
        <input
          type="text"
          className={input}
          value={value.name}
          readOnly={!!value.party}
          onChange={(e) => change({ name: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-gray-600">
        Amount
        <input
          type="number"
          min="0"
          step="0.01"
          className={input}
          value={value.amount}
          onChange={(e) => change({ amount: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-gray-600">
        Method
        <select
          className={`${input} capitalize`}
          value={value.method}
          onChange={(e) => change({ method: e.target.value as PaymentMethod })}
        >
          {['cash', 'bank_transfer', 'card', 'pos', 'cheque', 'other'].map(
            (m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, ' ')}
              </option>
            )
          )}
        </select>
      </label>
      <label className="block text-xs font-medium text-gray-600">
        Payment date (optional)
        <input
          type="date"
          className={input}
          value={value.date}
          onChange={(e) => change({ date: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
        Reference
        <input
          type="text"
          className={input}
          value={value.reference}
          onChange={(e) => change({ reference: e.target.value })}
          placeholder="Transfer, cheque or receipt reference"
        />
      </label>
    </fieldset>
  );
}
