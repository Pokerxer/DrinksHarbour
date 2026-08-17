# DrinksHarbour — Agent Entry Point

**Read this first, then [`AGENTS.md`](./AGENTS.md).**

This file is the top-level map. `AGENTS.md` holds the full system instructions:
role, skill-first protocol, platform architecture, revenue streams, tech stack,
tenant-isolation workstreams, and the never-violate rules.

Inherits from `~/.claude/CLAUDE.md` (global operating philosophy). Where this file
and the global file disagree, **this file wins**; where a nearer `rules.md` or a
direct user request disagrees with this file, **the nearer one wins**.

---

## Operating philosophy (inherited — the short form)

1. **Everything is a file.** Folders + Markdown are the architecture.
2. **One agent is enough.** The folder structure specialises it; do not spawn
   subagents, workflows, or multi-agent orchestration unless explicitly asked.
3. **Small, composable tools.** A one-purpose script in `server/scripts/` beats a
   framework. Skills are the canonical example — use them, don't wrap them.
4. **Context is location.** Behaviour follows the directory you are working in.
5. **Human-readable and editable.** Plain files, version-controlled, no opaque state.
6. **Software is still the moat.** The tree outlives the model.

Full version: `~/.claude/CLAUDE.md`.

---

## Where things actually live in this repo

The canonical `context/ domains/ tasks/ memory/ tools/ outputs/` layout maps onto
this codebase as follows. **Use these locations — do not create parallel folders.**

| Canonical role | Actual location here |
|---|---|
| Top-level map + global rules | `CLAUDE.md` (this file) → `AGENTS.md` |
| Project context, goals, constraints | `AGENTS.md`, `docs/saas/` |
| Domains / roles | `server/` (API, models, services), `client/apps/admin/` (super-admin + tenant dashboard), `client/apps/platform/` (storefront + tenant subdomains), `packages/` (shared) |
| Domain rules | The `AGENTS.md` section for that area; add a local `README.md` beside the code when a boundary needs its own rules |
| Tasks / current work | `docs/superpowers/specs/RESUME-*.md`, `docs/superpowers/plans/`, `.superpowers/sdd/progress.md` |
| Long-term memory | `~/.claude/projects/-Users-mac-Documents-drinksharbour/memory/` — one fact per file, indexed by `MEMORY.md` |
| Tools (one-thing scripts) | `server/scripts/`, `scripts/` |
| Generated artifacts | `docs/` handoff + prompt files; build output stays untracked |

---

## Session protocol

**Starting work:**
1. Read this file → `AGENTS.md` → the nearest `README.md`/`rules.md` to the code you're touching.
2. Check `docs/superpowers/specs/RESUME-*.md` for unfinished work before starting anything new.
3. Invoke every plausibly relevant skill before responding or writing code
   (see the Skill-First Operating Protocol in `AGENTS.md`).

**Finishing work:**
1. Verify — run the tests, don't assume. Baselines and the commands that actually
   work are recorded in the memory index; `npm test` on the server is broken, use
   `cd server && node --test '__tests__/*.test.js'`.
2. Update the files: the relevant `RESUME-*.md` spec, the memory entry, and any
   `rules.md` whose rules changed.
3. **Do not commit or push unless asked in that same turn.** Finished work is left
   uncommitted by default.
4. A cold reader must be able to resume from the files alone.

---

## Red flags — stop and write a file instead

- "I'll keep this in context" → it dies at compaction. Write it down.
- "Let me spin up agents / a workflow for this" → not requested. One agent, right folder.
- "This needs a planner or a state machine" → it needs a task file and a rules file.
- "I'll remember the convention" → the model changes; the file survives.
- "Docs after the code" → structure first, file contents second, code last.
