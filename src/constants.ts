export const SETTINGS_V3_META_KEY = "settings_v3_meta";
export const PAGE_KEY_PREFIX = "page_";
export const SELECTED_PAGE_KEY = "selectedPage";
export const SETTINGS_SAVE_DEBOUNCE_TIME = 1000;
export const SYNC_INTERVAL = 30000; // Sync from local to sync storage every 30 seconds
export const LAST_SYNC_TIME_KEY = "last_sync_time"; // Track when we last synced to sync storage
export const LAST_MERGE_TIME_KEY = "last_merge_time"; // Set only when the background script merges remote pages into local storage
export const SYNC_ENABLED_KEY = "syncEnabled"; // Whether to sync settings across browsers
export const MIGRATION_COMPLETE_KEY = "migrationComplete"; // Tracks if merge migration was done
export const REVIEW_PROMPT_KEY = "reviewPrompt";
export const REVIEWS_URL = "https://chromewebstore.google.com/detail/flexheaders-modify-http-h/gffpeamhhldhibdngenbfciboinanppf/reviews?utm_source=in-extension";
export const ISSUES_URL = "https://github.com/harrisondeo/FlexHeader/issues";
export const ERRORS_STATE_KEY = "flexheader_errors";

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