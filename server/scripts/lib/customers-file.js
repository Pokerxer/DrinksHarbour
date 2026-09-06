// scripts/lib/customers-file.js
//
// Load real customer identities from an .xlsx directory instead of generating
// them, so seeded orders carry the operator's own name list.
//
// Expected sheet layout (Nigerian_Names_Directory_200.xlsx):
//   row 1 : title banner
//   row 2 : headers  — S/N | First Name | Middle Name | Surname | Full Name |
//                      Gender | State of Origin | Email Address | Phone Number
//   row 3+: data
// The loader locates the header row by looking for "First Name" rather than
// assuming row 2, so a re-exported file with an extra banner row still works.
//
// The directory's first/surname are NOT shipped verbatim. They are only used
// to (a) pick one coherent ethnic group for the customer and (b) build the
// email local part. The actual name sent to the account is a first+last pair
// drawn from within that single ethnic group, so no customer ever ends up with
// a cross-ethnic composite like "Chidi Mohammed" or "Musa Okonkwo".
//
// Two server validators constrain what we can send (server/routes/user.routes.js):
//   phoneNumber  /^(\+?234|0)[7-9][01]\d{8}$/
//   password     >=8 chars w/ lower, upper, digit, one of @$!%*?&
// Directory phones arrive as "+234 81 646 1664" (spaced, 10 national digits)
// which fails that regex, so normalisePhone() rewrites them and any row that
// cannot be made valid is reported rather than silently dropped.

const XLSX = require('xlsx');
const {
  generateDob, generatePassword, generateConsumerEmail,
  ETHNIC_GROUPS, ETHNICITY_WEIGHTS,
} = require('./fake-data');

const PHONE_RE = /^(\+?234|0)[7-9][01]\d{8}$/;

/**
 * Convert a directory phone string into a value the register validator accepts.
 *
 * A Nigerian mobile has 10 national significant digits ([7-9][01] + 8 more),
 * e.g. 0803 123 4567. Every one of the 200 rows in the supplied directory has
 * only NINE — "+234 81 646 1664" is 81 646 1664, one digit short. Those numbers
 * cannot dial; they are placeholders in a synthetic persona list.
 *
 * Rather than reject all 200 rows, a check digit is appended so the value
 * satisfies the validator. It is derived from the existing digits, so it is
 * deterministic and repeatable across runs — but the resulting number is
 * FABRICATED, not the directory's data. `padded: true` is returned so the
 * caller can report exactly how many rows were altered.
 *
 * @returns {{ phone: string, padded: boolean }|null}
 */
function normalisePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('234')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);

  let padded = false;
  if (d.length === 9) {
    // Deterministic check digit: sum of digits mod 10.
    const sum = d.split('').reduce((s, c) => s + Number(c), 0);
    d += String(sum % 10);
    padded = true;
  }

  if (d.length !== 10) return null;
  const candidate = `0${d}`;
  return PHONE_RE.test(candidate) ? { phone: candidate, padded } : null;
}

/**
 * @param {string} filePath  path to the .xlsx
 * @param {object} [opts]
 * @param {number} [opts.limit]        cap how many rows are returned
 * @param {string} [opts.emailDomain]  override every email's domain (see below)
 * @returns {{ customers: Array, rejected: Array }}
 */
function loadCustomersFromXlsx(filePath, { limit = Infinity, emailDomain = null } = {}) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headerIdx = grid.findIndex((row) =>
    row.some((c) => String(c).trim().toLowerCase() === 'first name'));
  if (headerIdx === -1) {
    throw new Error(`${filePath}: could not find a header row containing "First Name"`);
  }

  const header = grid[headerIdx].map((c) => String(c).trim().toLowerCase());
  const col = (label) => header.indexOf(label);
  const iFirst = col('first name');
  const iSur   = col('surname');
  const iFull  = col('full name');
  const iEmail = col('email address');
  const iPhone = col('phone number');

  const customers = [];
  const rejected = [];
  const seenEmail = new Set();
  const usedFullNames = new Set();

  // Per-group name lookups so a directory row's first/surname can be scored
  // against the ethnic pools to pick a coherent group for that customer.
  const promoterByGroup = {};
  for (const [group, pool] of Object.entries(ETHNIC_GROUPS)) {
    promoterByGroup[group] = {
      first: new Set(pool.first.map((n) => n.toLowerCase())),
      last:  new Set(pool.last.map((n) => n.toLowerCase())),
      score: ETHNICITY_WEIGHTS[group] || 0,
    };
  }

  // Name allocation within a single ethnic group, tracking uniqueness.
  const allocate = (group) => {
    const { first, last } = ETHNIC_GROUPS[group];
    const combos = [];
    for (const fn of first) {
      for (const ln of last) {
        const full = `${fn} ${ln}`;
        if (!usedFullNames.has(full)) combos.push({ firstName: fn, lastName: ln });
      }
    }
    const c = combos[Math.floor(Math.random() * combos.length)] || combos[0];
    usedFullNames.add(`${c.firstName} ${c.lastName}`);
    return c;
  };

  for (let r = headerIdx + 1; r < grid.length && customers.length < limit; r += 1) {
    const row = grid[r];
    if (!row || row.every((c) => String(c).trim() === '')) continue;

    // Incoming directory row. Its mixed first/surname is used only to pick a
    // coherent ethnic group and for the email local part — never rendered
    // verbatim. The name shipped on the account and every order is a pair
    // drawn from ONE ethnic group, so no "Chidi Mohammed"/"Musa Okonkwo".
    const dirFirst = String(row[iFirst] || '').trim();
    const dirLast  = String(row[iSur]   || '').trim();
    const dirFull  = String(row[iFull]  || '').trim();
    let   email    = String(row[iEmail] || '').trim().toLowerCase();
    const phoneRaw = row[iPhone];

    if (!dirFirst || !dirLast || !email) {
      rejected.push({ row: r + 1, fullName: dirFull, reason: 'missing name or email' });
      continue;
    }

    // Ethnicity of this row = whichever group scores highest across its names.
    // "Chidi Mohammed" hits igbo.first + hausa.last (1 each) → the tie-break
    // is the group's overall weight, so it still resolves to one coherent group.
    const dFL = dirFirst.toLowerCase();
    const dLL = dirLast.toLowerCase();
    let best = null, bestScore = -1, bestWeight = -1;
    for (const [group, p] of Object.entries(promoterByGroup)) {
      let s = 0;
      if (p.first.has(dFL)) s += 1;
      if (p.last.has(dLL)) s += 1;
      if (s > bestScore || (s === bestScore && p.score > bestWeight)) {
        best = group; bestScore = s; bestWeight = p.score;
      }
    }
    const { firstName, lastName } = allocate(best);

    // The directory's own address is discarded along with its name. A consumer-
    // shaped address is built from the ethnic-consistent name instead, using a
    // mix of local-part styles and gmail/yahoo domains.
    //
    // ⚠️  These CAN collide with real mailboxes. Order confirmations are sent
    // per order and email.service.js does not gate on NODE_ENV, so any
    // environment holding this data must run with OUTBOUND_EMAIL=off.
    email = generateConsumerEmail(firstName, lastName, {
      used: seenEmail,
      domain: emailDomain,        // null → draw from the gmail/yahoo mix
    }).email;

    const phoneResult = normalisePhone(phoneRaw);
    if (!phoneResult) {
      rejected.push({ row: r + 1, fullName: dirFull, reason: `unusable phone "${phoneRaw}"` });
      continue;
    }

    // generateConsumerEmail already registered the address in seenEmail.
    customers.push({
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email,
      phoneNumber: phoneResult.phone,
      phonePadded: phoneResult.padded,
      phoneOriginal: String(phoneRaw || '').trim(),
      // The directory has no DOB. Orders here are alcohol, so every seeded
      // buyer must be an adult — generateDob() yields 21–55.
      dateOfBirth: generateDob(),
      password: generatePassword(),
      sourceRow: r + 1,
    });
  }

  return { customers, rejected };
}

module.exports = { loadCustomersFromXlsx, normalisePhone, PHONE_RE };
