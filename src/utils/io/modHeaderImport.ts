import type { HeaderFilter, HeaderSetting, Page } from "../domain/schemas";
import { filterIsValid } from "../domain/filterValidation";

interface ModHeaderHeaderEntry {
  enabled?: boolean;
  name?: string;
  value?: string;
  comment?: string;
  appendMode?: boolean;
}

interface ModHeaderUrlFilter {
  enabled?: boolean;
  urlRegex?: string;
  methods?: string[];
}

interface ModHeaderProfile {
  title?: string;
  shortTitle?: string;
  alwaysOn?: boolean;
  hideComment?: boolean;
  headers?: ModHeaderHeaderEntry[];
  respHeaders?: ModHeaderHeaderEntry[];
  urlFilters?: ModHeaderUrlFilter[];
  filters?: ModHeaderUrlFilter[];
  excludeUrlFilters?: ModHeaderUrlFilter[];
}

/**
 * ModHeader exports a plain JSON array of profile objects (no wrapper, no
 * version marker at the array level). Distinguished from a FlexHeader export
 * by the absence of `showHeaderComments` - a field every FlexHeader page has
 * carried since before this importer existed - combined with the presence of
 * a ModHeader-shaped header/filter list. `urlFilters`/`filters`/
 * `excludeUrlFilters` are checked too, not just `headers`/`respHeaders`, so a
 * profile that only has filters configured (no headers yet) still counts.
 */
export const isModHeaderExport = (data: unknown): data is ModHeaderProfile[] =>
  Array.isArray(data) &&
  data.length > 0 &&
  data.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const p = item as Record<string, unknown>;
    if ("showHeaderComments" in p) return false;
    return (
      Array.isArray(p.headers) ||
      Array.isArray(p.respHeaders) ||
      Array.isArray(p.urlFilters) ||
      Array.isArray(p.filters) ||
      Array.isArray(p.excludeUrlFilters)
    );
  });

const convertHeaders = (
  headers: ModHeaderHeaderEntry[] | undefined,
  headerType: HeaderSetting["headerType"],
  idPrefix: string,
  warnings: Set<string>
): HeaderSetting[] =>
  (headers ?? [])
    .filter((header) => typeof header?.name === "string" && header.name.trim() !== "")
    .map((header, index) => {
      if (header.appendMode) {
        warnings.add(
          "ModHeader's append mode isn't supported - those headers were imported as overwrite (Set)."
        );
      }
      return {
        id: `${idPrefix}-${headerType}-${index + 1}`,
        headerName: header.name as string,
        headerValue: header.value ?? "",
        headerComment: header.comment ?? "",
        headerEnabled: header.enabled !== false,
        headerType,
      };
    });

const convertFilters = (
  filters: ModHeaderUrlFilter[] | undefined,
  type: HeaderFilter["type"],
  idPrefix: string,
  warnings: Set<string>
): Omit<HeaderFilter, "valid">[] => {
  if (filters?.some((filter) => Array.isArray(filter?.methods) && filter.methods.length > 0)) {
    warnings.add(
      "HTTP method filters aren't supported - the imported rules apply to all methods."
    );
  }

  return (filters ?? [])
    .filter((filter) => typeof filter?.urlRegex === "string" && filter.urlRegex.trim() !== "")
    .map((filter, index) => ({
      id: `${idPrefix}-${type}-${index + 1}`,
      enabled: filter.enabled !== false,
      type,
      mode: "regex" as const,
      value: filter.urlRegex as string,
    }));
};

/**
 * Converts one ModHeader profile into a FlexHeader page. `id`/`pageId` are
 * left for the caller to assign - importSettingsFile mints a fresh pageId
 * for every imported page regardless of source.
 *
 * Imported disabled (`enabled: false`) because the conversion is lossy
 * (append mode, method filters, and any profile-selection state ModHeader
 * doesn't include in the export are all dropped) - nothing should start
 * modifying headers until the user has reviewed it. `alwaysOn` maps to
 * `keepEnabled` since both mean "stay active regardless of which page/profile
 * is selected".
 */
export const convertModHeaderProfile = async (
  profile: ModHeaderProfile,
  index: number,
  warnings: Set<string>
): Promise<Page> => {
  const idPrefix = `mh${index}`;
  const name =
    profile.title?.trim() || profile.shortTitle?.trim() || `Imported profile ${index + 1}`;

  const headers = [
    ...convertHeaders(profile.headers, "request", idPrefix, warnings),
    ...convertHeaders(profile.respHeaders, "response", idPrefix, warnings),
  ];

  const rawFilters = [
    ...convertFilters(profile.urlFilters ?? profile.filters, "include", idPrefix, warnings),
    ...convertFilters(profile.excludeUrlFilters, "exclude", idPrefix, warnings),
  ];

  // buildRulesFromPages only applies a filter when filter.valid is true, so
  // regexes ModHeader accepted but Chrome's RE2 engine rejects need to be
  // caught here - otherwise they'd silently import as a page whose headers
  // never fire for that filter.
  const filters: HeaderFilter[] = await Promise.all(
    rawFilters.map(
      (filter) =>
        new Promise<HeaderFilter>((resolve) => {
          filterIsValid(filter, (valid) => resolve({ ...filter, valid }));
        })
    )
  );

  if (filters.some((filter) => !filter.valid)) {
    warnings.add(
      "Some URL filters use regex Chrome doesn't support and won't apply until fixed."
    );
  }

  return {
    id: 0,
    name,
    enabled: false,
    keepEnabled: profile.alwaysOn === true,
    showHeaderComments: !profile.hideComment,
    headers,
    filters,
  };
};
