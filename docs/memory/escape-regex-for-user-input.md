---
name: escape-regex-for-user-input
description: Never build a RegExp from raw user input — new RegExp(userInput) throws a SyntaxError that surfaces as a 500 with a raw V8 message. Use escapeRegex from server/utils/escapeRegex.js.
type: memory
---

# Escape every regex built from user input

## The bug

```js
const term = new RegExp(search.trim(), 'i');   // search is a search-box string
```

`new RegExp` **compiles**, so a metacharacter throws `SyntaxError` at request
time. Inside `asyncHandler` that is an ordinary error, so it becomes a **500**
with V8's raw text as the message:

```
GET /api/subproducts?search=(   →  500
Invalid regular expression: /(/i: Unterminated group
GET /api/subproducts?search=[   →  500  Unterminated character class
GET /api/subproducts?search=*   →  500  Nothing to repeat
GET /api/subproducts?search=?   →  500  Nothing to repeat
GET /api/subproducts?search=C++ →  500  Nothing to repeat
```

A search box is not a regex editor. `C++` is a perfectly ordinary thing to type
when looking for a product, and `(` is a keystroke away from `9` on most
keyboards. It only ever surfaced as a console error because the client does
`catch { setInitial([]) }` — the page degrades to an empty dropdown and the
500 is invisible unless you are watching the console.

The same line is also a **pattern-injection** hole: `search=.*` previously meant
"match the entire catalogue" rather than the literal text `.*`.

## The fix

`escapeRegex` in `server/utils/escapeRegex.js`:

```js
const { escapeRegex } = require('../utils/escapeRegex');
const term = new RegExp(escapeRegex(search.trim()), 'i');
```

Escaping can only ever *reduce* what a search matches, so it is safe to apply
to anything that is meant to be a literal search. Keep it out of admin-only
"advanced pattern" inputs, where a real regex is the point.

## Why this recurred, and the rule that stops it

There were **six private copies** of the same escaper, each defined locally in
one file — `accounting.query.js`, `contact.helpers.js`, `mailContext.service.js`,
`product.service.js` (×2), `review.helpers.js`, `scanMatch.service.js`. The
files that shipped the bug were exactly the ones with **no local copy**:
`subproduct.service.js`, `search.service.js`, `user.service.js`. Nobody forgot
to escape; the helper simply did not exist where it was needed.

So the rule is: **there is one escaper, `server/utils/escapeRegex.js`.** Do not
add a seventh local copy. If you find a local `escapeRegex`/`escapeSearch`/
`escapeRegexLocal` definition, that is duplication to collapse, not a helper to
reuse.

Pinned by `server/__tests__/escapeRegex.test.js` (helper contract) and
`server/__tests__/subproduct.searchRegex.test.js` (the service path — verified
to fail with `Invalid regular expression: /(/i: Unterminated group` if the
escape is removed).

## Debugging note

When a browser-only 500 is undiagnosable, do not guess at the endpoint — mint a
token per user and replay the exact request. Sweeping all 41 users that could
reach a route proved the plain `?limit=50` path could not 500, which is what
redirected the search to the parameter actually being interpolated.
