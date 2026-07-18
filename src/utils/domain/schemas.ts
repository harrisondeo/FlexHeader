import { z } from "zod";

export const filterTypeSchema = z.enum(["include", "exclude"]);
export const filterModeSchema = z.enum(["regex", "url"]);

export const headerSettingSchema = z.object({
  id: z.string(),
  headerName: z.string(),
  headerValue: z.string(),
  headerComment: z.string().default(""),
  headerEnabled: z.boolean(),
  headerType: z.enum(["request", "response"]).default("request"),
});

export const headerFilterSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  valid: z.boolean(),
  type: filterTypeSchema,
  mode: filterModeSchema.default("regex"),
  value: z.string(),
});

export const pageSchema = z.object({
  id: z.number(),
  // Stable identity so mergePages can match "the same page" across browsers
  // even after an edit changes its content. Optional (not zod-defaulted)
  // because a default here would fabricate a fresh id on every parse -
  // legacy pages are backfilled once instead, in retrieveSettings.
  pageId: z.string().optional(),
  name: z.string().min(1),
  enabled: z.boolean(),
  keepEnabled: z.boolean(),
  showHeaderComments: z.boolean().default(true),
  filtersExpanded: z.boolean().default(true),
  filters: z.array(headerFilterSchema).default([]),
  headers: z.array(headerSettingSchema).default([]),
  // Resolves which side wins when the same page is edited on two synced
  // browsers. Optional rather than defaulted so legacy pages don't need one -
  // readers treat a missing value as 0, the oldest possible timestamp.
  lastModified: z.number().optional(),
});

export const pagesDataSchema = z.object({
  pages: z.array(pageSchema),
  selectedPage: z.number(),
});

export const settingsV3MetaSchema = z.object({
  version: z.literal(3),
  selectedPage: z.number(),
  pageCount: z.number(),
});

export type FilterType = z.infer<typeof filterTypeSchema>;
export type FilterMode = z.infer<typeof filterModeSchema>;
export type HeaderSetting = z.infer<typeof headerSettingSchema>;
export type HeaderFilter = z.infer<typeof headerFilterSchema>;
export type Page = z.infer<typeof pageSchema>;
export type PagesData = z.infer<typeof pagesDataSchema>;
export type SettingsV3Meta = z.infer<typeof settingsV3MetaSchema>;
