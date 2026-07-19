# Why is storage so complicated?

If you've poked around `src/background/background.ts`, `src/utils/settings.ts`,
`src/utils/pageStorage.ts`, or `src/utils/pageMerge.ts`, you've probably
wondered why saving a header takes a distributed storage format, a merge
algorithm, and tombstones instead of `storage.set(data)`. This page explains
the reasoning, so you don't have to reverse-engineer it from the diffs.

## Two storage areas, on purpose

FlexHeaders writes to `chrome.storage.local` and, optionally,
`chrome.storage.sync`. Sync is off by default and is a user-controlled
toggle.

### Sync is opt-in for privacy, not just architecture

Headers frequently carry things people don't want leaving their machine:
auth tokens, internal API keys, cookies used for testing, staging
credentials. If sync were always-on, enabling the extension would mean that
data leaves the local browser and travels through the browser vendor's sync
infrastructure to every other signed-in device, whether the user intended
that or not.

Keeping sync as an explicit opt-in means the default experience never sends
header data anywhere. `chrome.storage.local` never leaves the device it was
written on. Only users who deliberately want cross-device access flip
`syncEnabled` on.

This is also why `darkMode` and `historyEnabled` are hardcoded to local-only
storage rather than following the sync toggle — they're per-device UI
preferences, not something a privacy-conscious user would expect (or want)
propagated anywhere.

### `page_N` keys exist because of a real quota, not preference

`chrome.storage.sync` enforces a hard per-item cap:
[`QUOTA_BYTES_PER_ITEM`](https://developer.chrome.com/docs/extensions/reference/api/storage#property-sync-QUOTA_BYTES_PER_ITEM),
8,192 bytes (`SYNC_ITEM_BYTE_LIMIT` in `src/constants.ts`). An earlier version
of FlexHeaders stored the entire settings object — every page, every header,
every filter — as a single JSON blob under one key. Users with more than a
handful of pages or headers hit that 8KB ceiling and their sync writes
silently failed.

Splitting storage into one `page_N` key per page (plus a small
`settings_v3_meta` key describing how many there are) means each *page* gets
its own 8KB budget instead of the whole configuration sharing one. A user can
now have many pages, each with a reasonable number of headers, without
tripping the per-item limit — the practical ceiling is now the *sum* of all
page keys against sync's ~100KB total quota, not a single page having to fit
everything.

`chrome.storage.local` doesn't have this constraint (its default per-item
cap is far larger — see `STORAGE_LIMIT` in `src/utils/settings.ts`), but it
uses the same `page_N` layout anyway, purely for consistency between the two
storage areas and so the same read/merge code works against either one.

## Why local storage still exists once sync is on

Even with sync enabled, `chrome.storage.local` remains the primary store:

- **declarativeNetRequest rules are built from local storage.** The
  background worker needs an instant, always-available read to generate
  header rules — it can't depend on a network-backed store that might be
  slow, empty (freshly installed, not signed in), or briefly out of date
  relative to what the user just typed.
- **Sync is optional.** Users who leave sync off still need their settings
  to persist somewhere.
- **Local has far more headroom.** As above, sync's 8KB-per-item /
  ~100KB-total budget is comfortable for typical use but not something you'd
  want as your only copy of the data.

## Why merging isn't a simple overwrite

The two storage areas can drift out of sync with each other — a second
browser edits a page while this one is offline, or a page gets deleted on
one side while renamed on the other. A naive "last full write wins" sync
would silently erase whichever side wrote second with a smaller or older
snapshot.

Two mechanisms handle this, both in `src/utils/pageMerge.ts`:

- **`pageId`-based matching with `lastModified` timestamps** — pages are
  matched by a stable ID (not content), and conflicting edits resolve by
  whichever has the newer timestamp.
- **Tombstones for deletion** — a page's *absence* from one snapshot is
  ambiguous ("deleted" vs. "not synced yet"), so deletion is recorded
  explicitly (`{pageId, deletedAt}`) and only excludes a page if the
  tombstone is newer than that page's own last edit. Tombstones are pruned
  after 90 days (`TOMBSTONE_RETENTION_MS`) to bound how much they grow.

It's tempting to assume this machinery is only needed for "two devices
actively used at the same time," which is genuinely rare. But the same race
can happen **within a single browser**: the popup UI writes to local storage
directly, while the background service worker is independently pulling from
and pushing to sync on its own timer. A slow background write computed
before a popup edit can still land after it. The merge/tombstone logic is
what stops that from resurrecting a page the user just deleted, even on a
single device with sync never touched by another browser.

## Trade-offs accepted along the way

- **No field-level merge.** A conflicting edit to the same page resolves
  entirely to whichever side has the newer `lastModified` — not a per-header
  merge. Simpler to reason about, at the cost of not preserving both sides'
  changes in a genuine simultaneous edit.
- **A device offline for more than 90 days** could see an old deletion
  resurface, since its tombstone will have been pruned. Considered an
  acceptable trade for keeping tombstone lists small.
- **Local writes happen immediately on every change; sync pushes are
  debounced** (`SETTINGS_SAVE_DEBOUNCE_TIME`, 1 second) and otherwise run on
  a periodic interval (`SYNC_INTERVAL`, 10 seconds). Local needs to be
  current instantly for header rules to apply correctly; sync doesn't, and
  batching those writes keeps well clear of `chrome.storage.sync`'s write-rate
  limits.

None of this exists for its own sake — each piece maps to a real constraint
(a quota, a privacy expectation, or a bug that shipped once already). If
you're touching this code, `CLAUDE.md`'s "Storage model" and "Deletion needs
tombstones" sections go into more implementation detail than this page does.
