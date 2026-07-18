export const SETTINGS_V3_META_KEY = "settings_v3_meta";
export const PAGE_KEY_PREFIX = "page_";
export const SELECTED_PAGE_KEY = "selectedPage";
export const SETTINGS_SAVE_DEBOUNCE_TIME = 1000;
export const SYNC_INTERVAL = 10000; // Sync from local to sync storage every 10 seconds
export const SYNC_ITEM_BYTE_LIMIT = 8192; // chrome.storage.sync's per-item quota (QUOTA_BYTES_PER_ITEM)
export const LAST_SYNC_TIME_KEY = "last_sync_time"; // Track when we last pushed local data to sync storage
export const LAST_MERGE_TIME_KEY = "last_merge_time"; // Set only when the background script merges remote pages into local storage
export const LOCAL_MODIFIED_TIME_KEY = "localModifiedTime"; // Bumped on every local write - compared against LAST_SYNC_TIME_KEY to tell the user "sync pending" vs "synced"
export const SYNC_ENABLED_KEY = "syncEnabled"; // Whether to sync settings across browsers
export const PAGE_TOMBSTONES_KEY = "page_tombstones"; // Records deleted pageIds so deletions can propagate through the additive page merge
export const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // How long a tombstone is kept before being pruned
export const REVIEW_PROMPT_KEY = "reviewPrompt";
export const REVIEWS_URL = "https://chromewebstore.google.com/detail/flexheaders-modify-http-h/gffpeamhhldhibdngenbfciboinanppf/reviews?utm_source=in-extension";
export const ISSUES_URL = "https://github.com/harrisondeo/FlexHeader/issues";
export const ERRORS_STATE_KEY = "flexheader_errors";
export const UNDO_STACK_KEY = "undo_stack"; // Local only - a per-device history, not shared truth
export const REDO_STACK_KEY = "redo_stack";
export const HISTORY_ENABLED_KEY = "history_enabled"; // Local only - per-device preference for the undo/redo feature

export const POPULAR_HEADER_NAMES = [
  "Accept",
  "Accept-CH",
  "Accept-Charset",
  "Accept-Encoding",
  "Accept-Language",
  "Accept-Ranges",
  "Access-Control-Allow-Origin",
  "Age",
  "Allow",
  "Authorization",
  "Cache-Control",
  "Connection",
  "Content-Disposition",
  "Content-Encoding",
  "Content-Language",
  "Content-Length",
  "Content-Security-Policy",
  "Content-Type",
  "Cookie",
  "Cross-Origin-Embedder-Policy",
  "Date",
  "DNT",
  "ETag",
  "Expires",
  "Host",
  "If-Match",
  "If-Modified-Since",
  "If-None-Match",
  "Last-Modified",
  "Link",
  "Location",
  "Origin",
  "Range",
  "Referer",
  "Server",
  "Set-Cookie",
  "Strict-Transport-Security",
  "TE",
  "Trailer",
  "Transfer-Encoding",
  "Upgrade",
  "User-Agent",
  "Vary",
  "WWW-Authenticate",
  "X-Frame-Options",
  "X-Requested-With",
];