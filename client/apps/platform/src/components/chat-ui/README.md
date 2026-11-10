# chat-ui — shared chat presentation primitives (DRI-41)

WhatsApp-layout-grammar primitives shared by the customer chat surfaces:
`CustomerChat/ConversationPage`, `CustomerChat/ConversationList` and the
`Occasions/chat/**` post-send pane (which stays owned by that modal family —
chat-ui only supplies presentation, nothing owns state across families).

- **ChatBubble** — rounded alternating bubbles (`outgoing` right on light
  burgundy, `incoming` left on white), meta slot inside, max-width safe at
  320px.
- **ChatTicks** — honest delivery ticks: single check = sent, double check =
  read. A `read` state may only be passed when derived from the server staff
  watermark through `lib/chatStatus.ts chatReadState` — never invented.
- **ChatDayDivider** — centered day rail; labels come from
  `lib/chatFormatting.ts chatDayLabel` (WAT).
- **ChatHeader** — sticky caller-style header with back affordance and meta
  slot.
- **ChatComposer** — words-only composer; Enter/Shift+Enter/IME/touch guards
  live in `lib/chatKeyboard.ts`; textarea id must stay stable (tests).
- **ChatWallpaper** — static burgundy-tinted pattern; zero motion/parallax.
- **ConversationRow** — conversations list row with an accessible unread
  badge that is only rendered when the server count is > 0.

Rules carried from the profile-chat README: polled reads never fake presence
or read states; timestamps stay WAT-labelled; text renders escaped as plain
text; controls keep 44px targets and visible focus.
