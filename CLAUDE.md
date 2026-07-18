# CLAUDE.md

Guidance for AI agents working in this repo. This is a public open-source
project — keep it in mind when writing code and comments here.

This file should evolve. When you discover a non-obvious constraint, land a
pattern worth repeating, or get corrected on an approach, add a short note
here so the next agent doesn't have to rediscover it. Keep entries terse and
prefer deleting stale ones over letting them accumulate.

For setup, commands, and the PR checklist, see [CONTRIBUTING.md](CONTRIBUTING.md).
This file is about *how* to work in the codebase, not how to run it.

## Comment style

Comments should explain **why**, not what. Well-named code already says what
it does; a comment repeating that is noise a reviewer has to read past. Only
write one when the reasoning wouldn't survive without it — a constraint, a
past bug, a non-obvious trade-off. If removing the comment wouldn't confuse a
future reader, don't write it. This applies doubly here since the code is
public: comments referencing "the fix", an issue number, or "what we just
changed" rot the moment the PR merges.

## Architecture orientation

- `src/background/background.ts` — the MV3 service worker. It can be
  suspended by the browser at any time, so don't assume module-level state
  survives between calls; anything that must persist goes through
  `browser.storage`, not a variable.
- `src/utils/settings.ts` — `useFlexHeaderSettings`, the single React hook
  owning all page/header/filter state and its persistence. Exposed via
  `src/context/settingsContext.tsx` to the popup/options UI.
- `src/background/rules.ts` — turns pages/headers/filters into
  `declarativeNetRequest` rules (`buildRulesFromPages`).
- `src/utils/pageMerge.ts` — the sync/local merge logic, shared by both the
  background worker's continuous pull and the UI's one-time "enable sync"
  migration. Keep merge logic here, not duplicated in both callers.

## Storage model

Settings are split across many small keys rather than one blob:
`SETTINGS_V3_META_KEY` (`{version, selectedPage, pageCount}`) plus one
`page_N` key per page. This exists because `chrome.storage.sync` caps each
*item* at 8KB — a single large settings blob would blow that limit as soon as
a user has a few pages. `chrome.storage.local` has no such constraint, but
uses the same layout for consistency between the two.

Sync is not "on load" — the background worker pulls continuously via
`storage.sync.onChanged`, a periodic interval (`SYNC_INTERVAL`), and on
startup. A pull is *always additive*: local pages are only ever appended to
or updated in place, never dropped, even if sync storage is temporarily
smaller than local (e.g. a stale/partial write from another browser).

## Backward compatibility: normalize, not zod

`normalizePage` / `normalizeHeader` / `normalizeFilter`
(`src/utils/headers.ts`) are the real runtime compatibility layer, applied on
every storage read in both `background.ts` and `settings.ts`. Zod schemas
(`pageSchema`, etc.) are only actually `.parse()`d at the import/export file
boundary — everyday storage reads bypass zod and just cast. If you add a new
field with a default, it needs a fallback in the relevant `normalize*`
function, not just a zod `.default()`, or old stored data won't pick it up.

Corollary: don't make new `Page`/`HeaderSetting`/`HeaderFilter` fields
required (or zod-`.default()`, which makes the inferred TS type required
too) unless every existing literal construction site in the codebase already
provides one. Use `.optional()` and handle the missing case at read time
instead — this is why `pageId` and `lastModified` are both optional.

## Sync merge identity (`pageMerge.ts`)

Pages are matched across browsers by a stable `pageId` (`crypto.randomUUID()`,
assigned once and never regenerated), not by content. This matters because an
earlier content-based dedup key meant editing a header's value looked like a
"new" page to the other browser, forking a duplicate instead of updating in
place. Content-based `getPageKey` matching is now only a one-time fallback
for pre-migration pages that don't have a `pageId` yet — never used once both
sides have real ids, so two pages that coincidentally have identical content
are never wrongly collapsed into one.

Conflicts (same `pageId` edited on both sides) resolve last-write-wins via
`lastModified`. There is no field-level merge — this is a deliberate,
accepted trade-off, not an oversight.

`mergePages` returns the *same array reference* it was given when nothing
changed. Callers rely on this (`mergedPages !== localPages`) to cheaply
detect "did anything change" — including in-place edits, which a length
comparison would miss. Preserve this contract if you touch the function.

The built-in default page has a hardcoded `pageId: "default"` (not random) so
two fresh installs' untouched default pages recognize each other on first
sync instead of forking a duplicate immediately.

## Testing conventions

- Vitest + jsdom. Background/storage tests mock `webextension-polyfill` with:
  ```ts
  const browserMock = vi.hoisted(() => ({ storage: { local: {...}, sync: {...} }, ... }));
  vi.mock('webextension-polyfill', () => ({ default: browserMock, ...browserMock }));
  ```
  Follow this exact pattern (see `settings.test.ts` / `backgroundSync.test.ts`)
  rather than inventing a new mock shape — `vi.hoisted` is required because
  `vi.mock` calls are hoisted above imports.
- Derive mock area types from the mock factory (`type MockArea =
  ReturnType<typeof createMockArea>`) rather than hand-declaring a matching
  interface — hand-written mock types drift from the real mock and produce
  confusing "not assignable" errors instead of catching real bugs.
- `declarativeNetRequest` rule-generation tests compare against committed
  JSON fixtures (`src/background/__fixtures__/rules/`). Regenerate with
  `bun run test:update-fixtures` when a change is intentional.
