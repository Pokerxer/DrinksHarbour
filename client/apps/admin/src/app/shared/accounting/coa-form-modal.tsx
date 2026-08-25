'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { accountingService, type Account, type AccountType } from '@/services/accounting.service';
import { ACCOUNT_TYPE_LABELS } from './accounting-helpers';

const INPUT_CLS =
  'w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-gray-400';

/** Create/edit account modal. Codes are immutable after creation (409-guarded). */
export default function CoaFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [code, setCode] = useState(editing?.code ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState<AccountType>(editing?.type ?? 'expense');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCode(editing?.code ?? '');
    setName(editing?.name ?? '');
    setType(editing?.type ?? 'expense');
    setDescription(editing?.description ?? '');
  }, [editing]);

  const valid = code.trim().length > 0 && name.trim().length > 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      if (editing) {
        await accountingService.updateAccount(token, editing._id, { name, type, description });
        toast.success('Account updated');
      } else {
        await accountingService.createAccount(token, { code, name, type, description });
        toast.success('Account created');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit account' : 'New account'}
      >
        <h3 className="text-base font-semibold text-gray-900">
          {editing ? `Edit ${editing.code}` : 'New Account'}
        </h3>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-gray-600">
            Code
            <input
              type="text"
              className={`${INPUT_CLS} mt-1`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!!editing}
              placeholder="e.g. 6800"
            />
            {editing && <span className="mt-1 block text-[11px] text-gray-400">Codes are immutable</span>}
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Name
            <input
              type="text"
              className={`${INPUT_CLS} mt-1`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Licences & Permits"
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Type
            <select
              className={`${INPUT_CLS} mt-1`}
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
            >
              {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Description
            <input
              type="text"
              className={`${INPUT_CLS} mt-1`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={submit}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {editing ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
