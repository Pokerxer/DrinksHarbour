// Envelope mapping and special-folder resolution are pure functions over data
// IMAP hands back. They are tested without a connection — no test in this repo
// may touch the network.
//
// Folder names are NOT hardcoded: this server uses the "." hierarchy separator
// (INBOX.Sent), others use "/" (INBOX/Sent) or a flat "Sent". Resolution goes
// through the SPECIAL-USE flags every time.

const test = require('node:test');
const assert = require('node:assert');

const { mapEnvelope, specialFolder } = require('../services/imap.service');

const rawMessage = {
  uid: 42,
  flags: new Set(['\\Seen', '\\Answered']),
  envelope: {
    subject: 'Re: Order #DH-1043',
    messageId: '<abc@example.com>',
    inReplyTo: '<parent@example.com>',
    date: new Date('2026-07-30T10:00:00Z'),
    from: [{ name: 'Jane Doe', address: 'jane@example.com' }],
    to: [{ name: '', address: 'orders@drinksharbour.com' }],
  },
  bodyStructure: {
    type: 'multipart/mixed',
    childNodes: [
      { type: 'text/plain' },
      { type: 'application/pdf', disposition: 'attachment' },
    ],
  },
};

test('maps an IMAP message to a flat envelope', () => {
  const e = mapEnvelope(rawMessage, 'INBOX');
  assert.strictEqual(e.uid, 42);
  assert.strictEqual(e.folder, 'INBOX');
  assert.strictEqual(e.subject, 'Re: Order #DH-1043');
  assert.strictEqual(e.from.address, 'jane@example.com');
  assert.strictEqual(e.from.name, 'Jane Doe');
  assert.strictEqual(e.messageId, '<abc@example.com>');
});

test('reads flags into booleans', () => {
  const e = mapEnvelope(rawMessage, 'INBOX');
  assert.strictEqual(e.seen, true);
  assert.strictEqual(e.answered, true);
  assert.strictEqual(e.flagged, false);
});

test('an unread message maps to seen:false', () => {
  const e = mapEnvelope({ ...rawMessage, flags: new Set() }, 'INBOX');
  assert.strictEqual(e.seen, false);
});

test('detects attachments from the body structure', () => {
  assert.strictEqual(mapEnvelope(rawMessage, 'INBOX').hasAttachments, true);
});

test('a plain text message has no attachments', () => {
  const plain = { ...rawMessage, bodyStructure: { type: 'text/plain' } };
  assert.strictEqual(mapEnvelope(plain, 'INBOX').hasAttachments, false);
});

test('an inline image is not counted as an attachment', () => {
  const inline = {
    ...rawMessage,
    bodyStructure: {
      type: 'multipart/related',
      childNodes: [
        { type: 'text/html' },
        { type: 'image/png', disposition: 'inline' },
      ],
    },
  };
  assert.strictEqual(mapEnvelope(inline, 'INBOX').hasAttachments, false);
});

test('a missing subject becomes an explicit placeholder, never undefined', () => {
  const noSubject = { ...rawMessage, envelope: { ...rawMessage.envelope, subject: undefined } };
  assert.strictEqual(mapEnvelope(noSubject, 'INBOX').subject, '(no subject)');
});

test('a missing from address does not throw', () => {
  const noFrom = { ...rawMessage, envelope: { ...rawMessage.envelope, from: undefined } };
  const e = mapEnvelope(noFrom, 'INBOX');
  assert.strictEqual(e.from.address, '');
});

test('references parse into an array', () => {
  const withRefs = {
    ...rawMessage,
    envelope: { ...rawMessage.envelope, references: '<a@x.com> <b@x.com>' },
  };
  assert.deepStrictEqual(mapEnvelope(withRefs, 'INBOX').references, ['<a@x.com>', '<b@x.com>']);
});

test('resolves special folders by flag, not by name', () => {
  const folders = [
    { path: 'INBOX', specialUse: undefined },
    { path: 'INBOX.Sent', specialUse: '\\Sent' },
    { path: 'INBOX.Trash', specialUse: '\\Trash' },
  ];
  assert.strictEqual(specialFolder(folders, '\\Sent'), 'INBOX.Sent');
  assert.strictEqual(specialFolder(folders, '\\Trash'), 'INBOX.Trash');
});

test('a server with a different separator resolves the same way', () => {
  const folders = [
    { path: 'INBOX', specialUse: undefined },
    { path: 'Sent Items', specialUse: '\\Sent' },
  ];
  assert.strictEqual(specialFolder(folders, '\\Sent'), 'Sent Items');
});

test('an absent special folder returns null rather than a guess', () => {
  assert.strictEqual(specialFolder([{ path: 'INBOX' }], '\\Archive'), null);
});
