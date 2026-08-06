import { describe, expect, it } from 'vitest';
import { buildSeedDraft } from './draft-seed';
import type { MailMessage } from './types';

const message = (over: Partial<MailMessage> = {}): MailMessage => ({
  uid: 42,
  folder: 'INBOX.Drafts',
  subject: 'Refund request',
  from: { name: 'Ada', address: 'ada@example.com' },
  to: [{ name: '', address: 'support@drinksharbour.com' }],
  cc: [],
  date: '2026-08-01T10:00:00.000Z',
  messageId: '<m1@example.com>',
  inReplyTo: null,
  references: ['<m0@example.com>'],
  html: '<p>hello</p>',
  text: 'hello',
  attachments: [],
  blockedRemoteImages: 0,
  markedSeen: true,
  ...over,
});

describe('buildSeedDraft — draft mode', () => {
  it('restores the saved fields as-is', () => {
    const draft = buildSeedDraft(
      {
        mode: 'draft',
        message: message({
          to: [
            { name: '', address: 'a@x.com' },
            { name: 'B', address: 'b@x.com' },
          ],
          cc: [{ name: '', address: 'c@x.com' }],
          subject: 'Half-written',
          html: '<p>so far…</p>',
        }),
      },
      'support@drinksharbour.com'
    );

    expect(draft.to).toBe('a@x.com, b@x.com');
    expect(draft.cc).toBe('c@x.com');
    expect(draft.subject).toBe('Half-written');
    expect(draft.html).toBe('<p>so far…</p>');
  });

  it('does not quote or prefix — this is the operator’s own text', () => {
    const draft = buildSeedDraft(
      {
        mode: 'draft',
        message: message({ subject: 'Hello', html: '<p>hi</p>' }),
      },
      'support@drinksharbour.com'
    );
    expect(draft.subject).toBe('Hello');
    expect(draft.html).not.toContain('blockquote');
    expect(draft.html).not.toContain('wrote:');
  });

  it('carries the source uid so the old copy can be removed after a save', () => {
    const draft = buildSeedDraft(
      { mode: 'draft', message: message({ folder: 'INBOX.Drafts', uid: 7 }) },
      'x@y.com'
    );
    expect(draft.sourceDraft).toEqual({ folder: 'INBOX.Drafts', uid: 7 });
  });

  it('drops the server’s "(no subject)" placeholder', () => {
    // The compose path substitutes that string when the subject is blank, so
    // re-opening a subject-less draft must not show it as real typed text.
    const draft = buildSeedDraft(
      { mode: 'draft', message: message({ subject: '(no subject)' }) },
      'x@y.com'
    );
    expect(draft.subject).toBe('');
  });

  it('does not set reply threading headers', () => {
    // A draft is a message being written, not an answer to the message it was
    // read from; carrying In-Reply-To here would thread it against itself.
    const draft = buildSeedDraft(
      { mode: 'draft', message: message() },
      'x@y.com'
    );
    expect(draft.replyToMessageId).toBeUndefined();
    expect(draft.replyReferences).toBeUndefined();
  });

  it('never carries bcc or files over from the saved copy', () => {
    const draft = buildSeedDraft(
      { mode: 'draft', message: message() },
      'x@y.com'
    );
    expect(draft.bcc).toBe('');
    expect(draft.files).toEqual([]);
  });
});

describe('buildSeedDraft — the existing modes are unchanged', () => {
  it('new is empty and carries no source draft', () => {
    const draft = buildSeedDraft({ mode: 'new' }, 'x@y.com');
    expect(draft).toEqual({
      to: '',
      cc: '',
      bcc: '',
      subject: '',
      html: '',
      files: [],
    });
    expect(draft.sourceDraft).toBeUndefined();
  });

  it('reply addresses the sender, prefixes Re: and quotes', () => {
    const draft = buildSeedDraft(
      { mode: 'reply', message: message() },
      'support@drinksharbour.com'
    );
    expect(draft.to).toBe('ada@example.com');
    expect(draft.cc).toBe('');
    expect(draft.subject).toBe('Re: Refund request');
    expect(draft.html).toContain('blockquote');
    expect(draft.replyToMessageId).toBe('<m1@example.com>');
    expect(draft.sourceDraft).toBeUndefined();
  });

  it('reply-all keeps the others but drops our own address', () => {
    const draft = buildSeedDraft(
      {
        mode: 'replyAll',
        message: message({
          to: [
            { name: '', address: 'Support@DrinksHarbour.com' },
            { name: '', address: 'ops@x.com' },
          ],
          cc: [{ name: '', address: 'ops@x.com' }],
        }),
      },
      'support@drinksharbour.com'
    );
    expect(draft.cc).toBe('ops@x.com');
  });

  it('forward starts a new thread with no reply headers', () => {
    const draft = buildSeedDraft(
      { mode: 'forward', message: message() },
      'support@drinksharbour.com'
    );
    expect(draft.to).toBe('');
    expect(draft.subject).toBe('Fwd: Refund request');
    expect(draft.replyToMessageId).toBeUndefined();
  });

  it('does not double up an existing prefix', () => {
    expect(
      buildSeedDraft(
        { mode: 'reply', message: message({ subject: 'Re: Refund request' }) },
        'x@y.com'
      ).subject
    ).toBe('Re: Refund request');
  });
});
