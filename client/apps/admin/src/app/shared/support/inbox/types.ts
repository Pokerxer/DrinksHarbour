export interface MailAccount {
  id: string;
  address: string;
  displayName: string;
  scope: 'platform' | 'tenant';
  /** env accounts live in the server's deployment config and are read-only. */
  source: 'env' | 'db';
}

export interface CreateMailAccountPayload {
  address: string;
  password: string;
  displayName?: string;
  username?: string;
  imapHost?: string;
  imapPort?: string;
  smtpHost?: string;
  smtpPort?: string;
}

export interface MailFolder {
  path: string;
  name: string;
  specialUse: string | null;
  total: number;
  unseen: number;
}

export interface MailAddress {
  name: string;
  address: string;
}

export interface MailEnvelope {
  uid: number;
  folder: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  date: string | null;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  hasAttachments: boolean;
  preview: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
}

export interface MailAttachment {
  index: number;
  filename: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

export interface MailMessage {
  uid: number;
  folder: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  date: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  html: string;
  text: string;
  attachments: MailAttachment[];
  blockedRemoteImages: number;
  /**
   * Whether the server actually managed to flag the message \Seen.
   *
   * False means the flag is NOT set — the STORE was refused, the mailbox is
   * read-only, or the uid vanished — and deliberately does not say which. The
   * body was still fetched and is safe to render; only the unread state is
   * unchanged.
   */
  markedSeen: boolean;
}

export interface MessagePage {
  items: MailEnvelope[];
  total: number;
  page: number;
  limit: number;
}

/**
 * What the server reports back about a send.
 *
 * `accepted` / `rejected` exist because SMTP can accept only SOME recipients
 * and still resolve successfully. A send with a non-empty `rejected` is NOT a
 * plain success and must never be presented as one. A send where nothing was
 * accepted does not reach here at all — the server raises an error for it.
 */
export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  partial: boolean;
  appendedTo: string | null;
  sentCopy: {
    status: 'filed' | 'no-folder' | 'failed';
    path: string | null;
    error: string | null;
  };
}

/** One line of a sender's order history, as shown in the Customer panel. */
export interface CustomerOrder {
  id: string;
  orderNumber: string | null;
  date: string | null;
  status: string;
  paymentStatus: string | null;
  total: number;
  currency: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string | null;
  customerSince: string | null;
  /**
   * The `source:id` handle for the admin Contacts page, or null when that page
   * would not resolve — the directory is tenant-scoped, so the server only hands
   * over a key that will actually load.
   */
  contactKey: string | null;
}

/** Separate ledgers (see the User model); never summed. */
export interface CustomerWallet {
  platformBalance: number;
  storeBalance: number;
  loyaltyPoints: number;
  loyaltyTier: string | null;
}

/**
 * Who a sender is, as a customer.
 *
 * `customer: null` is the normal answer for someone we have never sold to and
 * means "no customer record" — it is NOT an error, and the panel must not
 * render it as one. A genuine failure arrives as a thrown error instead.
 */
export interface CustomerContext {
  email: string;
  customer: CustomerRecord | null;
  wallet: CustomerWallet | null;
  orders: CustomerOrder[];
  /** The whole history, so the panel can say "5 of 9" honestly. */
  orderCount: number;
}

/**
 * A canned reply. `body` is HTML the server has already sanitized on write —
 * it is inserted straight into the compose editor and rendered as a preview,
 * so it is never re-sanitized here.
 */
export interface Snippet {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdBy: { id: string; name: string } | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SnippetPayload {
  title: string;
  body: string;
  tags: string[];
}

export interface ComposeDraft {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  html: string;
  files: File[];
  replyToMessageId?: string | null;
  replyReferences?: string[];
  /**
   * The draft this compose was opened from, when it was opened from one.
   *
   * Present only in 'draft' mode. Saving or sending files a NEW copy, so
   * without deleting this uid afterwards the Drafts folder grows a duplicate on
   * every edit. Deleted last, never first — losing the old copy before the new
   * one exists would lose the operator's text outright.
   */
  sourceDraft?: { folder: string; uid: number } | null;
}
