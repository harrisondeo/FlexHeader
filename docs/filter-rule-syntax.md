# Filter rule syntax

FlexHeaders supports two filter modes for controlling which requests a header applies to:

- **Regex** — uses Chrome's `declarativeNetRequest` regex syntax.
- **URL** — uses Chrome's `declarativeNetRequest` `urlFilter` syntax.

See the [Chrome declarativeNetRequest documentation](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) for the full filter specification.

## Regex mode

Regex filters are matched against the full request URL. See the [regexFilter documentation](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-RuleCondition-regexFilter) for details.

Common examples:

| Value | Meaning |
|-------|---------|
| `^https://example\.com/.*` | Any URL on `example.com` |
| `example\.com` | Any URL containing `example.com` |
| `\.(png\|jpg\|gif)$` | Image file extensions |

Enter a single backslash to escape regex metacharacters, so `\.` matches a literal dot.

## URL mode

URL filters use the DNR `urlFilter` pattern syntax. They are faster and simpler than regex for matching domains or URL prefixes. See the [urlFilter documentation](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-RuleCondition-urlFilter) for details.

### Special characters

| Character | Meaning |
|-----------|---------|
| `*` | Matches any sequence of characters |
| `\|` | Anchors the pattern to the start or end of the URL |
| `\|\|` | Domain anchor — matches the domain and any subdomain or port |
| `^` | Separator — matches any character not allowed in a URL token |

### Examples

| Value | Matches |
|-------|---------|
| `\|\|example.com/` | `https://example.com/...`, `https://www.example.com/...` |
| `\|\|example.com\|` | Exactly `https://example.com/` (domain + right anchor) |
| `\|https://example.com/` | URLs starting with `https://example.com/` |
| `https://example.com\|` | URLs ending with `https://example.com/` |
| `*example.com*` | Any URL containing `example.com` |
| `\|http*` | Any HTTP or HTTPS URL |

### Invalid patterns

The following will be rejected:

- Empty values
- Non-ASCII characters
- `||*` and `||`
- Misplaced `\|` characters, e.g. `ex\|ample.com`

## Include vs exclude

- **Include** — the header is applied only when the URL matches the filter.
- **Exclude** — the header is removed for URLs matching the filter.

Excludes have higher priority than includes. If no include filters are set, the header applies to all URLs by default.
