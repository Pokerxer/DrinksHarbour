import type {
  CreateMailAccountPayload,
  CustomerContext,
  MailAccount,
  MailFolder,
  MailMessage,
  MessagePage,
  ComposeDraft,
  SendResult,
  Snippet,
  SnippetPayload,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

/**
 * Every failure here becomes a thrown Error carrying the server's own message.
 * The mail server being unreachable must never surface as an empty inbox.
 */
async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}/api/mail${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Mail request failed (${res.status})`);
  }
  if (!res.ok || !body.success) {
    throw new Error(body.message || `Mail request failed (${res.status})`);
  }
  return body.data;
}

export const fetchAccounts = (token: string) =>
  request<MailAccount[]>('/accounts', token);

/** The server verifies the IMAP login before persisting anything. */
export const createAccount = (
  token: string,
  payload: CreateMailAccountPayload
) =>
  request<MailAccount>('/accounts', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deleteAccount = (token: string, accountId: string) =>
  request<{ id: string }>(`/accounts/${encodeURIComponent(accountId)}`, token, {
    method: 'DELETE',
  });

/**
 * Who a sender is, as a customer. Asks about an address, not a mailbox, so it
 * carries no accountId.
 */
export const fetchCustomerContext = (token: string, email: string) =>
  request<CustomerContext>(
    `/context?email=${encodeURIComponent(email)}`,
    token
  );

/**
 * Canned replies. Shared by the whole support team and not tied to a mailbox,
 * so like /context these carry no accountId.
 */
export const fetchSnippets = (token: string) =>
  request<Snippet[]>('/snippets', token);

export const createSnippet = (token: string, payload: SnippetPayload) =>
  request<Snippet>('/snippets', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/** A partial patch: a title-only edit must not blank the body. */
export const updateSnippet = (
  token: string,
  id: string,
  payload: Partial<SnippetPayload>
) =>
  request<Snippet>(`/snippets/${encodeURIComponent(id)}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteSnippet = (token: string, id: string) =>
  request<{ id: string }>(`/snippets/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });

export const fetchFolders = (token: string, accountId: string) =>
  request<MailFolder[]>(`/${encodeURIComponent(accountId)}/folders`, token);

export function fetchMessages(
  token: string,
  accountId: string,
  params: {
    folder: string;
    page?: number;
    limit?: number;
    search?: string;
    unread?: boolean;
    unanswered?: boolean;
  }
) {
  // Only ever sent as the literal 'true' — the server matches that exactly, so
  // an omitted param and a disabled filter are the same thing on the wire.
  const query = new URLSearchParams({
    folder: params.folder,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 25),
    ...(params.search ? { search: params.search } : {}),
    ...(params.unread ? { unread: 'true' } : {}),
    ...(params.unanswered ? { unanswered: 'true' } : {}),
  });
  return request<MessagePage>(
    `/${encodeURIComponent(accountId)}/messages?${query}`,
    token
  );
}

export function fetchMessage(
  token: string,
  accountId: string,
  folder: string,
  uid: number,
  showImages = false
) {
  const query = new URLSearchParams({ folder, images: String(showImages) });
  return request<MailMessage>(
    `/${encodeURIComponent(accountId)}/messages/${uid}?${query}`,
    token
  );
}

export const setFlags = (
  token: string,
  accountId: string,
  payload: { folder: string; uids: number[]; add?: string[]; remove?: string[] }
) =>
  request<{ uids: number[] }>(
    `/${encodeURIComponent(accountId)}/messages/flags`,
    token,
    { method: 'POST', body: JSON.stringify(payload) }
  );

export const moveMessages = (
  token: string,
  accountId: string,
  payload: { folder: string; uids: number[]; to: string }
) =>
  request<{ uids: number[]; to: string }>(
    `/${encodeURIComponent(accountId)}/messages/move`,
    token,
    { method: 'POST', body: JSON.stringify(payload) }
  );

export function deleteMessages(
  token: string,
  accountId: string,
  folder: string,
  uids: number[]
) {
  const query = new URLSearchParams({ folder, uids: uids.join(',') });
  return request<{ expunged: boolean; movedTo: string | null }>(
    `/${encodeURIComponent(accountId)}/messages?${query}`,
    token,
    { method: 'DELETE' }
  );
}

/**
 * The multipart body both /send and /drafts take.
 *
 * `sourceDraft` is deliberately NOT sent: it is a client-side bookkeeping field
 * naming the copy to delete afterwards, and the server has no use for it.
 */
function draftForm(draft: ComposeDraft): FormData {
  const form = new FormData();
  form.append('to', draft.to);
  form.append('cc', draft.cc);
  form.append('bcc', draft.bcc);
  form.append('subject', draft.subject);
  form.append('html', draft.html);
  if (draft.replyToMessageId) {
    form.append('replyToMessageId', draft.replyToMessageId);
    form.append('replyReferences', (draft.replyReferences || []).join(' '));
  }
  draft.files.forEach((file) => form.append('attachments', file));
  return form;
}

export function sendMessage(
  token: string,
  accountId: string,
  draft: ComposeDraft
) {
  return request<SendResult>(`/${encodeURIComponent(accountId)}/send`, token, {
    method: 'POST',
    body: draftForm(draft),
  });
}

/** Files the message in the account's Drafts folder without sending it. */
export function saveDraft(
  token: string,
  accountId: string,
  draft: ComposeDraft
) {
  return request<{ appendedTo: string; messageId: string }>(
    `/${encodeURIComponent(accountId)}/drafts`,
    token,
    { method: 'POST', body: draftForm(draft) }
  );
}

/**
 * Downloads an attachment.
 *
 * This cannot be a plain <a href> link: the admin authenticates by Bearer
 * token, and a browser-initiated navigation sends no Authorization header, so
 * the request would 401. Instead we fetch with the header and hand the browser
 * a blob. The object URL is revoked immediately after the click — leaving them
 * alive pins the whole attachment in memory for the life of the tab.
 */
export async function downloadAttachment(
  token: string,
  accountId: string,
  folder: string,
  uid: number,
  index: number,
  filename: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/mail/${encodeURIComponent(accountId)}/messages/${uid}/attachments/${index}?folder=${encodeURIComponent(folder)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    // The error body is JSON even though the success body is binary.
    let message = `Could not download ${filename} (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Not JSON — keep the status-based message rather than masking it.
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
