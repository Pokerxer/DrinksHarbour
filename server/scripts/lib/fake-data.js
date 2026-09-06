// scripts/lib/fake-data.js
//
// Nigerian-realistic customer and address generation for the purchase seeder.
//
// The phone and password shapes are not cosmetic — they are dictated by the
// validators in server/routes/user.routes.js:
//   phoneNumber  /^(\+?234|0)[7-9][01]\d{8}$/
//   password     >= 8 chars with lower, upper, digit and one of @$!%*?&
// generatePhone() and generatePassword() below are written to satisfy those
// exactly; assertShapes() at the bottom checks them at require-time.


// ── Ethnicity-aware Nigerian name pools ────────────────────────────────────
//
// Every customer gets a first and last name from the SAME ethnic group so the
// seed personas read as coherent Nigerian names rather than cross-ethnic
// composites (no "Chidi Balogun" or "Musa Okonkwo").
//
// Additions are welcome — keep each pool internally consistent, and label new
// entries in comments if their ethnic alignment is not obvious from the name
// itself.

const ETHNIC_GROUPS = {
  igbo: {
    first: [
      'Chidi', 'Ngozi', 'Emeka', 'Amaka', 'Ifeanyi', 'Chioma', 'Obinna',
      'Adaeze', 'Uche', 'Nneka', 'Kelechi', 'Chinelo', 'Chinedu', 'Oluchi',
      'Ijeoma', 'Nkechi', 'Chiamaka', 'Chidiebere', 'Nnenna', 'Adanna',
      'Chibuzo', 'Ezinne', 'Ifunanya', 'Onyinye', 'Ugochi',
    ],
    last: [
      'Okafor', 'Okonkwo', 'Nwosu', 'Eze', 'Chukwu', 'Obi', 'Nnamdi',
      'Onyeka', 'Uzoma', 'Emenike', 'Chukwuma', 'Anyanwu', 'Iheanacho',
      'Nwachukwu', 'Ezeji', 'Okoro', 'Umeh', 'Nduka', 'Ibekwe',
      'Ofili', 'Ezeaku', 'Ozoemena', 'Onwueme',
    ],
  },
  hausa: {
    first: [
      'Musa', 'Aisha', 'Sadiq', 'Halima', 'Ibrahim', 'Zainab', 'Abubakar',
      'Amina', 'Fatima', 'Abdullahi', 'Hauwa', 'Idris', 'Yusuf', 'Safiya',
      'Ahmad', 'Suleiman', 'Bilkisu', 'Nuhu', 'Ramatu', 'Mustapha',
      'Aliyu', 'Hadiza', 'Umar',
    ],
    last: [
      'Abubakar', 'Ibrahim', 'Bello', 'Lawal', 'Mohammed', 'Danjuma',
      'Sani', 'Abdullahi', 'Usman', 'Garba', 'Jibril', 'Shehu',
      'Dauda', 'Musa', 'Abba', 'Inuwa', 'Suleiman', 'Mahmud',
    ],
  },
  yoruba: {
    first: [
      'Tunde', 'Folake', 'Bola', 'Yemi', 'Segun', 'Kemi', 'Femi',
      'Temitope', 'Damilola', 'Funmilayo', 'Kehinde', 'Bukola', 'Adeola',
      'Olumide', 'Aderonke', 'Dolapo', 'Kayode', 'Ifeoluwa', 'Adebisi',
      'Wuraola', 'Bolanle', 'Bidemi', 'Oluwaseun', 'Adetayo',
    ],
    last: [
      'Adeyemi', 'Oladele', 'Adebayo', 'Ogunleye', 'Afolabi', 'Adewale',
      'Akinyemi', 'Balogun', 'Ojo', 'Bello', 'Akinwumi', 'Fashola',
      'Adekunle', 'Olawale', 'Adedoyin', 'Abiodun', 'Omotoso', 'Ayodele',
      'Alade', 'Sowande',
    ],
  },
};

const ETHNICITY_WEIGHTS = { igbo: 0.34, yoruba: 0.34, hausa: 0.32 };
const ETHNIC_KEYS = Object.keys(ETHNIC_GROUPS);

/**
 * Allocate a single ethnicity-consistent full name.
 *
 * @param {Set<string>} usedFullNames  set of full names already assigned in
 *   this batch — the function will not return a duplicate.
 * @param {{ (): number }} [random]    injectable RNG for deterministic runs.
 * @param {string} [ethnicity]         force a specific group; omit for
 *   weighted random pick.
 * @returns {{ firstName: string, lastName: string, ethnicity: string }}
 */
function allocateCustomerName(usedFullNames, random = Math.random, ethnicity = null) {
  // Select the ethnic group if not pinned by the caller.
  if (!ethnicity || !ETHNIC_GROUPS[ethnicity]) {
    const roll = random();
    let cumulative = 0;
    for (const key of ETHNIC_KEYS) {
      cumulative += ETHNICITY_WEIGHTS[key];
      if (roll < cumulative) { ethnicity = key; break; }
    }
    ethnicity = ethnicity || 'igbo';
  }

  const pool = ETHNIC_GROUPS[ethnicity];
  // Build the full cross-product, filter out already-used combos, and pick
  // uniformly. With 25 first × 23 last per group (~575 combos), the 200-
  // customer batch has <0.3% chance of exhausting any single group.
  const combos = [];
  for (const fn of pool.first) {
    for (const ln of pool.last) {
      const full = `${fn} ${ln}`;
      if (!usedFullNames.has(full)) combos.push({ firstName: fn, lastName: ln });
    }
  }
  if (combos.length === 0) {
    throw new Error(
      `allocateCustomerName: ethnic group "${ethnicity}" exhausted ` +
      `(${pool.first.length} first × ${pool.last.length} last = ` +
      `${pool.first.length * pool.last.length} combos, all used)`,
    );
  }
  const pick = combos[Math.floor(random() * combos.length)];
  const fullName = `${pick.firstName} ${pick.lastName}`;
  usedFullNames.add(fullName);
  return { firstName: pick.firstName, lastName: pick.lastName, ethnicity };
}

const FIRST_NAMES = ETHNIC_KEYS.flatMap((k) => ETHNIC_GROUPS[k].first);
const LAST_NAMES  = ETHNIC_KEYS.flatMap((k) => ETHNIC_GROUPS[k].last);

// state / city pairs kept consistent so the shipping zone lookup in
// server/data/shipping-zones.js resolves to a real zone rather than the
// unknown-state fallback.
const LOCATIONS = [
  { state: 'FCT',    city: 'Abuja',        lga: 'Abuja Municipal', zipCode: '900001' },
  { state: 'FCT',    city: 'Gwarinpa',     lga: 'Abuja Municipal', zipCode: '900108' },
  { state: 'FCT',    city: 'Wuse',         lga: 'Abuja Municipal', zipCode: '900281' },
  { state: 'Lagos',  city: 'Ikeja',        lga: 'Ikeja',           zipCode: '100271' },
  { state: 'Lagos',  city: 'Lekki',        lga: 'Eti-Osa',         zipCode: '106104' },
  { state: 'Lagos',  city: 'Surulere',     lga: 'Surulere',        zipCode: '101283' },
  { state: 'Rivers', city: 'Port Harcourt',lga: 'Port Harcourt',   zipCode: '500272' },
  { state: 'Oyo',    city: 'Ibadan',       lga: 'Ibadan North',    zipCode: '200223' },
  { state: 'Kano',   city: 'Kano',         lga: 'Kano Municipal',  zipCode: '700213' },
  { state: 'Enugu',  city: 'Enugu',        lga: 'Enugu North',     zipCode: '400102' },
];

const STREETS = [
  'Ademola Adetokunbo Crescent', 'Aminu Kano Crescent', 'Herbert Macaulay Way',
  'Awolowo Road', 'Adeola Odeku Street', 'Gimbiya Street', 'Ligali Ayorinde Street',
  'Nnamdi Azikiwe Road', 'Bourdillon Road', 'Tafawa Balewa Way', 'Ahmadu Bello Way',
];

/** Uniform pick from an array. */
function pick(arr, random = Math.random) {
  return arr[Math.floor(random() * arr.length)];
}

/** Inclusive integer in [min, max]. */
function intBetween(min, max, random = Math.random) {
  return Math.floor(random() * (max - min + 1)) + min;
}

/**
 * Nigerian mobile number matching /^(\+?234|0)[7-9][01]\d{8}$/.
 * Built as 0 + [7-9] + [01] + 8 digits.
 */
function generatePhone(random = Math.random) {
  const prefix = pick(['7', '8', '9'], random);
  const second = pick(['0', '1'], random);
  let rest = '';
  for (let i = 0; i < 8; i += 1) rest += String(intBetween(0, 9, random));
  return `0${prefix}${second}${rest}`;
}

// ── Consumer email addresses ───────────────────────────────────────────────
//
// Real people do not all format their address the same way, so seeded
// addresses must not either — 400 rows of `first.last@` reads as generated at
// a glance. These are the shapes actual Nigerian consumer inboxes take.
//
// ⚠️  DELIVERABILITY: with CONSUMER_EMAIL_DOMAINS pointed at gmail.com /
// yahoo.com these addresses can and will collide with real mailboxes.
// order.controller.js sends an order confirmation for every order placed, and
// services/email.service.js does NOT check NODE_ENV on its send path. Keep
// OUTBOUND_EMAIL=off in any environment holding this data.

const CONSUMER_EMAIL_DOMAINS = [
  // Weighted towards gmail, which dominates Nigerian consumer email.
  'gmail.com', 'gmail.com', 'gmail.com', 'gmail.com', 'gmail.com', 'gmail.com',
  'yahoo.com', 'yahoo.com', 'yahoo.com',
  'yahoo.co.uk',
];

// Local-part builders. `n` is a small number used by the styles that take one.
// Deliberately mixed: dotted, dotless, underscored, initial-based and
// nickname-style, so no single separator dominates the dataset.
const EMAIL_STYLES = [
  { name: 'first.last',      build: (f, l) => `${f}.${l}` },
  { name: 'firstlast',       build: (f, l) => `${f}${l}` },
  { name: 'first_last',      build: (f, l) => `${f}_${l}` },
  { name: 'firstlastNN',     build: (f, l, n) => `${f}${l}${n}` },
  { name: 'first.lastNN',    build: (f, l, n) => `${f}.${l}${n}` },
  { name: 'f.last',          build: (f, l) => `${f[0]}${l}` },
  { name: 'f.last.dotted',   build: (f, l) => `${f[0]}.${l}` },
  { name: 'first.l',         build: (f, l) => `${f}.${l[0]}` },
  { name: 'firstNN',         build: (f, l, n) => `${f}${n}` },
  { name: 'lastfirst',       build: (f, l) => `${l}${f}` },
  { name: 'last.first',      build: (f, l) => `${l}.${f}` },
  { name: 'first_lastNN',    build: (f, l, n) => `${f}_${l}${n}` },
];

/**
 * Build a consumer-looking email address for a person.
 *
 * @param {string} firstName
 * @param {string} lastName
 * @param {object} [opts]
 * @param {Set<string>} [opts.used]    addresses already taken (lower-cased)
 * @param {string} [opts.domain]       force a domain; omit to pick one
 * @param {() => number} [opts.random]
 * @returns {{ email: string, style: string, domain: string }}
 */
function generateConsumerEmail(firstName, lastName, { used = null, domain = null, random = Math.random } = {}) {
  const f = String(firstName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const l = String(lastName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const taken = used instanceof Set ? used : new Set();

  // Try each style in a shuffled order, with a couple of number variants, and
  // take the first address nobody already holds. Falling through to a wider
  // number range keeps this terminating even on a heavily-collided surname.
  // Roughly a third of real consumer addresses carry trailing digits (birth
  // year, lucky number, or whatever was free when they signed up). Decide up
  // front whether THIS address is a numeric one, rather than only reaching for
  // digits on collision — otherwise the bare form always wins and the dataset
  // ends up with none.
  const wantsNumber = random() < 0.34;
  const numberPool = wantsNumber
    ? [
      String(intBetween(1, 99, random)),
      String(intBetween(1960, 2004, random)),   // birth-year style
      String(intBetween(100, 999, random)),
      '',
    ]
    : ['', String(intBetween(1, 99, random)), String(intBetween(100, 999, random))];

  // Only the {f,l,n} styles actually render `n`, so when this address is meant
  // to carry digits, try those first — otherwise a no-number style wins the
  // shuffle and the digits silently vanish.
  const takesNumber = (s) => s.build.length >= 3;
  const styles = [...EMAIL_STYLES].sort(() => random() - 0.5);
  if (wantsNumber) styles.sort((a, b) => Number(takesNumber(b)) - Number(takesNumber(a)));

  for (const style of styles) {
    for (const n of numberPool) {
      const local = style.build(f, l, n);
      if (!local || local.length < 4) continue;
      const dom = domain || pick(CONSUMER_EMAIL_DOMAINS, random);
      const email = `${local}@${dom}`;
      if (!taken.has(email.toLowerCase())) {
        taken.add(email.toLowerCase());
        return { email, style: style.name, domain: dom };
      }
    }
  }
  // Exhausted every style — fall back to a guaranteed-unique numeric suffix.
  const dom = domain || pick(CONSUMER_EMAIL_DOMAINS, random);
  let n = 1;
  let email = `${f}.${l}${n}@${dom}`;
  while (taken.has(email.toLowerCase())) {
    n += 1;
    email = `${f}.${l}${n}@${dom}`;
  }
  taken.add(email.toLowerCase());
  return { email, style: 'fallback', domain: dom };
}

/**
 * Password guaranteed to satisfy the register validator:
 * >= 8 chars, at least one lowercase, uppercase, digit and one of @$!%*?&
 * The random middle is drawn only from [A-Za-z0-9] so it can never introduce a
 * character outside the validator's allowed class.
 */
function generatePassword(random = Math.random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let middle = '';
  for (let i = 0; i < 8; i += 1) middle += alphabet[Math.floor(random() * alphabet.length)];
  // Fixed anchors guarantee each required class is present regardless of `middle`.
  return `Sd${middle}9!`;
}

/**
 * Build one seeded customer.
 *
 * Seeded rows are identified by `createdBy` (the seed admin's id) and by the
 * `seedSource` marker on orders/reviews — NOT by the email local part — so the
 * address is free to look like a real consumer inbox.
 *
 * @param {object} opts
 * @param {string} [opts.emailDomain]  force one domain for every customer;
 *   omit to draw from CONSUMER_EMAIL_DOMAINS (gmail/yahoo mix).
 * @param {Set<string>} [opts.usedNames]   full names already assigned
 * @param {Set<string>} [opts.usedEmails]  addresses already assigned
 * @param {() => number} [opts.random]
 */
function generateCustomer({
  emailDomain = null, random = Math.random, usedNames = null, usedEmails = null,
} = {}) {
  const names = usedNames instanceof Set
    ? allocateCustomerName(usedNames, random)
    : allocateCustomerName(new Set(), random);
  const { firstName, lastName } = names;

  const { email } = generateConsumerEmail(firstName, lastName, {
    used: usedEmails instanceof Set ? usedEmails : new Set(),
    domain: emailDomain,
    random,
  });

  return {
    firstName,
    lastName,
    email,
    password: generatePassword(random),
    phoneNumber: generatePhone(random),
    // 21–55 years old. Used for the age gate on alcoholic products.
    dateOfBirth: generateDob(random),
  };
}

/** ISO date string for someone aged 21–55. */
function generateDob(random = Math.random) {
  const age = intBetween(21, 55, random);
  const now = new Date();
  const year = now.getUTCFullYear() - age;
  const month = intBetween(0, 11, random);
  const day = intBetween(1, 28, random);
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

/** Whole years between a YYYY-MM-DD string and now. */
function ageFromDob(dob) {
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return 0;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

/** Shipping address whose state/lga resolve against shipping-zones.js. */
function generateAddress(random = Math.random) {
  const loc = pick(LOCATIONS, random);
  return {
    address: `${intBetween(1, 240, random)} ${pick(STREETS, random)}`,
    city: loc.city,
    state: loc.state,
    lga: loc.lga,
    zipCode: loc.zipCode,
    country: 'Nigeria',
  };
}

// Require-time guard: if someone edits the generators and breaks the server's
// regexes, fail here rather than after 5 wasted registrations against the
// 5-per-hour rate limit.
function assertShapes() {
  const phoneRe = /^(\+?234|0)[7-9][01]\d{8}$/;
  const pwRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
  for (let i = 0; i < 200; i += 1) {
    const phone = generatePhone();
    if (!phoneRe.test(phone)) throw new Error(`fake-data: generated invalid phone "${phone}"`);
    const pw = generatePassword();
    if (pw.length < 8 || !pwRe.test(pw)) throw new Error(`fake-data: generated invalid password "${pw}"`);
  }
}

assertShapes();

module.exports = {
  FIRST_NAMES, LAST_NAMES, LOCATIONS, STREETS,
  CONSUMER_EMAIL_DOMAINS, EMAIL_STYLES, generateConsumerEmail,
  ETHNIC_GROUPS, ETHNICITY_WEIGHTS, allocateCustomerName,
  pick, intBetween,
  generatePhone, generatePassword, generateCustomer, generateDob, ageFromDob,
  generateAddress, assertShapes,
};
