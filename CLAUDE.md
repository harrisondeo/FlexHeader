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
- `src/utils/pageStorage.ts` — `readPageStorage(area)`, the one place that
  knows how to read the v3 distributed page format (`settings_v3_meta` +
  `page_N` keys + tombstones) out of a storage area. Used by both
  `background.ts` (push/pull) and `settings.ts` (`toggleSync`'s enable-sync
  merge) — add any new read path here rather than re-writing the `page_N`
  fetch loop, which used to exist three times across the two files.
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
startup. A pull never drops a page just because it's absent from one side —
see "Deletion needs tombstones" below for why absence alone is never trusted.

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

## Deletion needs tombstones

An additive merge can't represent "this page was deleted" - a page's absence
looks identical to "haven't synced it yet," so an early version of this merge
would resurrect a page deleted on one browser as soon as it pulled a
not-yet-updated remote snapshot (this reproduced even on a single browser,
from the background worker's pull-before-push ordering within one tick).

Fix: deletion gets the same kind of signal an edit already has via
`lastModified` - a tombstone (`{pageId, deletedAt}`, `PAGE_TOMBSTONES_KEY`).
`mergeSyncState` (not `mergePages` directly) is the one entry point every
"combine a local view with a remote view" call site must use, so tombstone
handling can't be bypassed: it unions tombstones (newest `deletedAt` per
`pageId` wins), excludes any page whose tombstone is newer than its own
`lastModified` from *both* sides, then hands the survivors to `mergePages`.
An edit newer than a delete un-deletes the page - deliberate, symmetric with
the existing edit-vs-edit last-write-wins rule, not a bug.

Old tombstones are pruned (`TOMBSTONE_RETENTION_MS`, 90 days) whenever
they're written, to bound growth - accepted trade-off: a device offline
longer than that could see a very old delete resurrected.

Two non-obvious consequences worth knowing before touching this code:
- The "if no pages left, recreate a default page" fallback (`removePage`,
  and `mergeSyncState` itself for the no-UI background path) must mint a
  *fresh* `pageId`/`lastModified` (`synthesizeFallbackPage`), never reuse the
  deleted page's own identity - otherwise the tombstone that was just
  created would immediately re-exclude the page it recreated.
- `mergeSyncState` must never return an empty page array. A merge (not just
  `removePage`) can legitimately tombstone every page a device has (two
  untouched installs share the pristine default page's fixed `"default"`
  id; one of them deletes it), and `background.ts` has no popup open to run
  the UI's own empty-pages safety net.

### Concurrent writers can still race - two defenses, not one

`background.ts`'s pull/push has three independent, unsynchronized triggers
(the interval, `storage.sync.onChanged`, and the initial startup call) - a
real signed-in-elsewhere account can fire `onChanged` while another trigger
is still mid-flight awaiting its own storage round-trips. `runSyncSerially`
(a simple promise-chain queue) makes sure these three can never run a
pull/push cycle concurrently with *each other*.

That alone doesn't cover every writer: the foreground popup (`settings.ts`)
writes local storage directly, independent of and unsynchronized with
background's queue. A slow background merge computed *before* a foreground
delete can still finish *after* it. `writePagesToLocalStorage` defends
against this specifically: right before committing, it re-reads local
storage's current tombstones and unions them in (never just overwrites),
then re-applies the unioned set to the pages it's about to write. This is
what stops a stale in-flight merge from silently erasing a tombstone the
foreground just created and resurrecting the page it protected - see
`writePagesToLocalStorage race protection` in `backgroundSync.test.ts`.

### Push must merge too, not just pull

`syncLocalToRemoteStorage` used to push local's raw page/tombstone view to
sync storage unconditionally every cycle. That's a blind "last full write
wins" - if another browser pushed a page in the gap since this browser's own
last pull, this push would overwrite sync storage's copy with a smaller
snapshot that doesn't know that page exists, and the stale-key cleanup would
then delete its `page_N` key outright. This was the most likely cause of "a
new page sometimes doesn't sync to the other browser at all" - not a
`chrome.storage.sync` quota issue (`MAX_WRITE_OPERATIONS_PER_HOUR` is 1800;
our interval-driven push cadence is nowhere near that).

Fix: push now re-reads sync storage's current state and runs it through the
same `mergeSyncState` the pull path uses *before* writing, pushing the merged
result instead of local's raw view - see `does not clobber a page another
browser already pushed...` in `backgroundSync.test.ts`. If that merge turns
up something local didn't have, it's written back to local too
(`writePagesToLocalStorage`), so push doubles as a catch-up pull rather than
requiring a separate round trip.

`darkMode` and `selectedPage` are deliberately **not** synced at all -
they're per-device preferences (a user may want dark mode on one browser and
not another), not shared truth. Syncing them with no last-write-wins
protection is what caused an earlier bug where toggling dark mode on one
browser would get silently flipped back by the other browser's next push.

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
