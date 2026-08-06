'use client';

import cn from '@core/utils/class-names';
import { useAtom } from 'jotai';
import { useState } from 'react';
import { PiPlusBold, PiTrashDuotone, PiXBold } from 'react-icons/pi';
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Input,
  Password,
  Text,
  Title,
} from 'rizzui';
import * as api from './api';
import { accountIdAtom, mailRefreshAtom } from './mail-state';
import SenderAvatar from './sender-avatar';
import { useMailAccounts, useMailToken } from './use-mail';
import type { CreateMailAccountPayload } from './types';

const EMPTY: CreateMailAccountPayload = {
  address: '',
  password: '',
  displayName: '',
  username: '',
  imapHost: '',
  imapPort: '',
  smtpHost: '',
  smtpPort: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Adds and removes mailboxes. Env-defined accounts are listed but read-only —
 * they belong to the deployment config, and the server refuses to touch them.
 * Creation is server-verified: the backend logs into the IMAP server with the
 * submitted credentials before persisting anything, so a typo'd password is an
 * inline error here, never a broken mailbox discovered later.
 */
export default function ManageAccountsDrawer({ open, onClose }: Props) {
  const token = useMailToken();
  const [refresh, setRefresh] = useAtom(mailRefreshAtom);
  const [accountId, setAccountId] = useAtom(accountIdAtom);
  const accounts = useMailAccounts(refresh);

  const [form, setForm] = useState<CreateMailAccountPayload>(EMPTY);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Two-step remove: the first click arms this id, the second actually deletes.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const set = (patch: Partial<CreateMailAccountPayload>) =>
    setForm((f) => ({ ...f, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api.createAccount(token, form);
      setForm(EMPTY);
      setShowAdvanced(false);
      setNotice(`${created.address} added and verified.`);
      setRefresh((n) => n + 1);
    } catch (err) {
      // The message is the server's own: wrong password, unknown host and
      // "not allowed" all read differently, and all matter here.
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!token || deletingId) return;
    setDeletingId(id);
    setError(null);
    setNotice(null);
    try {
      await api.deleteAccount(token, id);
      // Removing the mailbox currently in use must not leave the UI pointed at
      // an id the server will now refuse.
      if (accountId === id) {
        const next = (accounts.data || []).find((a) => a.id !== id);
        setAccountId(next?.id ?? null);
      }
      setRefresh((n) => n + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <Drawer isOpen={open} onClose={onClose} size="md">
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-muted p-5">
          <Title as="h3" className="text-lg font-semibold">
            Mail accounts
          </Title>
          <ActionIcon variant="text" onClick={onClose} aria-label="Close">
            <PiXBold className="h-4 w-4" />
          </ActionIcon>
        </header>

        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-5">
          <div>
            <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Connected mailboxes
            </Text>
            {accounts.error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
              >
                <Text className="text-sm text-red-700 dark:text-red-400">
                  {accounts.error}
                </Text>
              </div>
            )}
            <ul className="divide-y divide-muted rounded-lg border border-muted">
              {(accounts.data || []).map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <SenderAvatar
                    name={a.displayName}
                    address={a.address}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <Text className="truncate text-sm font-medium">
                      {a.displayName}
                    </Text>
                    <Text className="truncate text-xs text-gray-500">
                      {a.address}
                    </Text>
                  </div>
                  {a.source === 'env' ? (
                    <Badge
                      variant="flat"
                      color="secondary"
                      size="sm"
                      className="shrink-0"
                      title="Defined in the server environment — remove it there"
                    >
                      Server config
                    </Badge>
                  ) : confirmId === a.id ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        color="danger"
                        isLoading={deletingId === a.id}
                        onClick={() => remove(a.id)}
                      >
                        Remove
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deletingId === a.id}
                        onClick={() => setConfirmId(null)}
                      >
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <ActionIcon
                      size="sm"
                      variant="text"
                      className="shrink-0 text-gray-500 hover:text-red-600"
                      title={`Remove ${a.address}`}
                      onClick={() => setConfirmId(a.id)}
                    >
                      <PiTrashDuotone className="h-4 w-4" />
                    </ActionIcon>
                  )}
                </li>
              ))}
              {!accounts.error && (accounts.data?.length ?? 0) === 0 && (
                <li className="px-4 py-6 text-center">
                  <Text className="text-sm text-gray-500">
                    {accounts.loading ? 'Loading…' : 'No mailboxes yet'}
                  </Text>
                </li>
              )}
            </ul>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Add a mailbox
            </Text>
            <Input
              label="Email address"
              type="email"
              required
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="support@drinksharbour.com"
            />
            <Password
              label="Password"
              required
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
              helperText="Checked against the mail server before anything is saved, then stored encrypted."
            />
            <Input
              label="Display name"
              value={form.displayName}
              onChange={(e) => set({ displayName: e.target.value })}
              placeholder="DrinksHarbour Support"
            />

            <button
              type="button"
              className="cursor-pointer text-sm font-medium text-primary hover:underline"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? 'Hide server settings' : 'Server settings'}
            </button>

            {showAdvanced && (
              <div className="space-y-4 rounded-lg border border-muted p-4">
                <Input
                  label="Login username"
                  value={form.username}
                  onChange={(e) => set({ username: e.target.value })}
                  helperText="Only if it differs from the email address."
                />
                <div className="grid grid-cols-[1fr_6rem] gap-3">
                  <Input
                    label="IMAP host"
                    value={form.imapHost}
                    onChange={(e) => set({ imapHost: e.target.value })}
                    placeholder="Server default"
                  />
                  <Input
                    label="Port"
                    type="number"
                    value={form.imapPort}
                    onChange={(e) => set({ imapPort: e.target.value })}
                    placeholder="993"
                  />
                </div>
                <div className="grid grid-cols-[1fr_6rem] gap-3">
                  <Input
                    label="SMTP host"
                    value={form.smtpHost}
                    onChange={(e) => set({ smtpHost: e.target.value })}
                    placeholder="Server default"
                  />
                  <Input
                    label="Port"
                    type="number"
                    value={form.smtpPort}
                    onChange={(e) => set({ smtpPort: e.target.value })}
                    placeholder="465"
                  />
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
              >
                <Text className="text-sm font-medium text-red-700 dark:text-red-400">
                  {error}
                </Text>
              </div>
            )}
            {notice && (
              <div
                role="status"
                className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30"
              >
                <Text className="text-sm font-medium text-green-700 dark:text-green-400">
                  {notice}
                </Text>
              </div>
            )}

            <Button
              type="submit"
              isLoading={saving}
              disabled={saving || !form.address.trim() || !form.password}
              className="w-full"
            >
              <PiPlusBold className="me-1.5 h-4 w-4" /> Add mailbox
            </Button>
          </form>
        </div>
      </div>
    </Drawer>
  );
}
