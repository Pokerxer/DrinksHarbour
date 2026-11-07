// Deterministic gift-message templates by relationship × occasion. Fixed
// phrasing only: no delivery promises, brand claims or invented details. The
// customer edits the wording; nothing here is sent anywhere automatically.
export type GiftRelationship = 'family' | 'friend' | 'colleague' | 'client';
export type GiftOccasion = 'birthday' | 'thank-you' | 'congratulations' | 'festive';

export const GIFT_RELATIONSHIPS: { value: GiftRelationship; label: string }[] = [
  { value: 'family', label: 'Family' },
  { value: 'friend', label: 'Friend' },
  { value: 'colleague', label: 'Colleague' },
  { value: 'client', label: 'Client' },
];

export const GIFT_OCCASIONS: { value: GiftOccasion; label: string }[] = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'thank-you', label: 'Thank you' },
  { value: 'congratulations', label: 'Congratulations' },
  { value: 'festive', label: 'Festive season' },
];

const OCCASION_OPENINGS: Record<GiftOccasion, string[]> = {
  birthday: [
    'Happy birthday, {name} — cheers to your day!',
    'A toast to {name} — happy birthday!',
    'Wishing {name} a warm and happy birthday.',
  ],
  'thank-you': [
    'With thanks to {name} — for everything.',
    'Thank you, {name} — this one is for you.',
    'A small token of our thanks, {name}.',
  ],
  congratulations: [
    'Congratulations, {name} — well deserved!',
    'To {name} on this milestone — congratulations!',
    'So glad to celebrate {name} today.',
  ],
  festive: [
    'Wishing {name} a joyful festive season.',
    'Season’s greetings to {name} and theirs.',
    'Warm festive wishes to you, {name}.',
  ],
};

const RELATIONSHIP_TAILS: Record<GiftRelationship, string[]> = {
  family: ['With love from all of us.', 'From the family, always.', 'Home isn’t the same without you — enjoy.'],
  friend: ['Your friend always.', 'Here’s to many more good times.', 'To friendship, from both of us.'],
  colleague: ['Great working with you.', 'From the team, with appreciation.', 'On behalf of the whole group.'],
  client: ['With appreciation for your partnership.', 'Valued partners like you make the work light.', 'In appreciation of your continued trust.'],
};

/** Three deterministic messages for a relationship × occasion pair. */
export function giftMessages(relationship: GiftRelationship, occasion: GiftOccasion, name: string): string[] {
  const recipient = name.trim() || 'you';
  const opens = OCCASION_OPENINGS[occasion], tails = RELATIONSHIP_TAILS[relationship];
  // Deterministic pairing across three rotations so each message differs.
  return opens.map((_, index) => `${opens[index].replaceAll('{name}', recipient)} ${tails[(index + OCCASION_KEYS.indexOf(occasion) + index) % tails.length]}`.trim());
}

const OCCASION_KEYS = Object.keys(OCCASION_OPENINGS) as GiftOccasion[];
