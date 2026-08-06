import type { ComposeDraft, MailMessage } from './types';

export type ReplyMode = 'reply' | 'replyAll' | 'forward';

/**
 * What the compose drawer was opened for.
 *
 * 'draft' is not a reply mode: it re-opens a message that is ALREADY a draft,
 * so its fields are restored as-is rather than quoted, and the original is
 * deleted once a newer copy exists.
 */
export type ComposeSeed =
  | { mode: 'new' }
  | { mode: ReplyMode | 'draft'; message: MailMessage };

const withPrefix = (subject: string, prefix: string) =>
  subject.toLowerCase().startsWith(prefix.toLowerCase())
    ? subject
    : `${prefix} ${subject}`;

/**
 * Quotes the message being answered.
 *
 * `m.html` is the body the SERVER already sanitized — never `m.text`, which is
 * returned unsanitized on the assumption React escapes it, and never the raw
 * body. This string goes into the editor and then back out as the sent HTML.
 */
const quote = (m: MailMessage) =>
  `<br><br><blockquote>On ${
    m.date ? new Date(m.date).toLocaleString() : 'an earlier date'
  }, ${m.from.name || m.from.address} wrote:<br>${m.html}</blockquote>`;

/**
 * Seeds a draft from the message the drawer was opened on.
 *
 * Reply-all keeps every other recipient but drops our own address, so the
 * mailbox does not end up replying to itself. Threading headers ride along so
 * the reply lands in the right conversation in the recipient's client — a
 * forward deliberately carries none, because it starts a new thread.
 */
export function buildSeedDraft(
  seed: ComposeSeed,
  selfAddress: string
): ComposeDraft {
  const empty: ComposeDraft = {
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    html: '',
    files: [],
  };
  if (seed.mode === 'new') return empty;

  const m = seed.message;

  // Editing an existing draft: restore exactly what was saved. Nothing is
  // quoted or prefixed — this text is the operator's own unfinished message,
  // not somebody else's mail being answered. `sourceDraft` is what lets the
  // drawer delete this copy once a newer one has been filed, so re-saving
  // twice does not leave three drafts in the folder.
  //
  // Attachments cannot be restored: the drawer holds File objects to upload
  // and the saved draft has only server-side parts, which there is no API to
  // re-attach. Saying nothing would silently drop them on the next save, so
  // the drawer warns instead — see `lostAttachments`.
  if (seed.mode === 'draft') {
    return {
      ...empty,
      to: m.to
        .map((a) => a.address)
        .filter(Boolean)
        .join(', '),
      cc: m.cc
        .map((a) => a.address)
        .filter(Boolean)
        .join(', '),
      subject: m.subject === '(no subject)' ? '' : m.subject,
      html: m.html,
      sourceDraft: { folder: m.folder, uid: m.uid },
    };
  }

  if (seed.mode === 'forward') {
    return {
      ...empty,
      subject: withPrefix(m.subject, 'Fwd:'),
      html: quote(m),
    };
  }

  const self = selfAddress.toLowerCase();
  const others = [...m.to, ...m.cc]
    .map((a) => a.address)
    .filter((a) => a && a.toLowerCase() !== self);

  return {
    ...empty,
    replyToMessageId: m.messageId,
    replyReferences: m.references,
    to: m.from.address,
    cc: seed.mode === 'replyAll' ? Array.from(new Set(others)).join(', ') : '',
    subject: withPrefix(m.subject, 'Re:'),
    html: quote(m),
  };
}
