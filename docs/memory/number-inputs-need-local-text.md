---
name: number-inputs-need-local-text
description: A controlled type="number" with Number(e.target.value) cannot accept decimals at all — the trailing dot is eaten, so 89678.98 becomes 8967898. Use NumberInput from src/components/ui/number-input.tsx for every number field.
type: memory
---

# Number fields cannot be hand-rolled

## The bug

A controlled `type="number"` whose onChange does `Number(e.target.value)`
**cannot accept a decimal**, whatever `step` says. Typing `89678.98`:

| typed | onChange receives | `Number(...)` | state | box shows |
|---|---|---|---|---|
| `8` | `8` | 8 | 8 | 8 |
| `9` | `89` | 89 | 89 | 89 |
| `6` | `896` | 896 | 896 | 896 |
| `7` | `8967` | 8967 | 8967 | 8967 |
| `8` | `89678` | 89678 | 89678 | 89678 |
| `.` | `89678.` | **89678** | 89678 | `89678` ← **dot gone** |
| `9` | `896789` | 896789 | 896789 | 896789 |
| `8` | `8967898` | 8967898 | 8967898 | 8967898 |

`Number("89678.")` is `89678`, so the dot never survives the state update and
the field snaps back to a whole number. The operator types `89678.98` and gets
`8967898`. **Adding `step="0.01"` does not help** — the character is discarded
before `step` is ever consulted. Chasing this as a `step` problem is the trap.

## The fix

`NumberInput` in `client/apps/admin/src/components/ui/number-input.tsx`. It
holds the raw text locally and never replaces it with the committed number
mid-typing, so every keystroke lands. Parseable text commits live (totals stay
in sync); empty/unparseable text is left alone until blur, which normalizes to
`fallback ?? min ?? 0` and re-clamps.

```jsx
<NumberInput
  min={0}
  step="0.01"
  value={item.unitPrice}
  onCommit={(v) => updateItem(i, { unitPrice: v })}
/>
```

`value` + `onCommit`, never `value` + `onChange`. Its decision logic is exported
as pure functions (`numberInputChange`, `numberInputNormalize`) precisely
because the repo has no DOM test tooling — that is where the decimal regression
is pinned, including a replay of the `89678.98` keystroke sequence.

**Rule: never write `value={n}` + `Number(e.target.value)` on a number field.**
Use `NumberInput`. It was promoted out of `sales/` to `components/ui/` for
exactly this reason — it is no longer sales-specific.

## Still unconverted

The pattern is widespread and most sites are still hand-rolled: **62 sites across
35 files**. Not all of them are money fields (many are filter boxes and integer
ids where the dot-swallow is harmless because the value is genuinely an
integer), so convert the ones that take money, quantities or rates rather than
sweeping the grep blindly:

```
grep -rln "Number(e.target.value)" client/apps/admin/src
```

Highest-value remaining in the purchase/receive path:
`purchases-receipt-detail.tsx` (receive qty — also has no `step` at all, so the
browser rejects decimals twice over), `stock-transfer-create.tsx`,
`transfer-receive-panel.tsx`, `purchases-settings.tsx`,
`purchases-agreement-detail.tsx`, `purchases/pricelists/*`. The POS cart
(`point-of-sale/components/pos-cart.tsx`) and
`multi-step/quantity-input.tsx` are the highest-traffic ones outside purchases.

Note that the sales line table deliberately rounds quantity
(`onCommit={(v) => onUpdate(line.key, { quantity: Math.round(v) })}`) while
purchases takes the decimal as typed — bottles and cases are sold fractionally,
so rounding belongs at the sales line, not in the input.
