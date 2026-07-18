/**
 * Formats a past timestamp as a short relative string ("just now", "5m ago"),
 * for surfacing sync status without implying more precision than a user
 * needs (see sync status indicator in appHeader/settingsPage).
 */
export const formatRelativeTime = (timestamp: number, now: number = Date.now()): string => {
  const diffMs = Math.max(0, now - timestamp);
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 10) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};
