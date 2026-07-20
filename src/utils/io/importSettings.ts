import { z } from "zod";
import type { Dispatch, SetStateAction } from "react";
import type { AlertContextType } from "../../context/alertContext";
import { pageSchema, type Page, type PagesData } from "../domain/schemas";
import { normalizePage } from "../domain/headers";
import { convertModHeaderProfile, isModHeaderExport } from "./modHeaderImport";

const importedPayloadSchema = z
  .array(pageSchema)
  .min(1, "Imported file does not contain any pages.");

const INVALID_FILE_MESSAGE =
  "Invalid settings file. Please export settings from FlexHeader or ModHeader and try again.";

/**
 * Accepts either a FlexHeader settings export or a ModHeader profile export.
 * FlexHeader's own schema is tried first; a file that doesn't match it falls
 * back to ModHeader detection rather than failing outright.
 */
const parseImportedPages = async (
  parsedJson: unknown
): Promise<{ pages: Page[]; warnings: string[] }> => {
  const flexHeaderResult = importedPayloadSchema.safeParse(parsedJson);
  if (flexHeaderResult.success) {
    return { pages: flexHeaderResult.data.map(normalizePage), warnings: [] };
  }

  if (isModHeaderExport(parsedJson)) {
    const warnings = new Set<string>();
    const pages = await Promise.all(
      parsedJson.map((profile, index) => convertModHeaderProfile(profile, index, warnings))
    );
    return { pages, warnings: [...warnings] };
  }

  throw new Error(INVALID_FILE_MESSAGE);
};

/**
 * Parses an exported settings JSON file and appends its pages to the
 * current set. Always mints a fresh pageId per imported page (even if the
 * file already has one - e.g. re-importing a previous export, or a file
 * exported from a device this one already syncs with) - import always
 * appends alongside existing pages (never replaces), so reusing an existing
 * pageId would put two pages sharing one identity in the same local list,
 * which is exactly the bug class that made a duplicated page collide with
 * its original on sync.
 */
export const importSettingsFile = (
  file: File,
  { setPagesData, alertContext }: {
    setPagesData: Dispatch<SetStateAction<PagesData>>;
    alertContext: AlertContextType;
  }
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = async (e) => {
      try {
        const result = e.target?.result;

        if (typeof result !== "string") {
          reject(new Error("Unable to read file contents."));
          return;
        }

        const { pages: parsedPages, warnings } = await parseImportedPages(JSON.parse(result));

        // remap the ids to avoid conflicts
        setPagesData((prev) => {
          const importedPages = parsedPages.map((page) => ({
            ...page,
            pageId: crypto.randomUUID(),
            lastModified: page.lastModified || Date.now(),
          }));
          const combinedPages = [...prev.pages, ...importedPages];
          const newPages = combinedPages.map((page, index) => ({
            ...page,
            id: index,
          }));

          return {
            ...prev,
            pages: newPages,
          };
        });

        alertContext.setAlert(
          warnings.length > 0
            ? {
                alertType: "warning",
                alertText: `Imported from ModHeader with some limitations: ${warnings.join(" ")}`,
                location: "bottom",
              }
            : {
                alertType: "success",
                alertText: "Settings imported.",
                location: "bottom",
              }
        );

        resolve();
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Failed to import settings.");

        alertContext.setAlert({
          alertType: "error",
          alertText: err.message,
          location: "bottom",
        });

        reject(err);
      }
    };
    reader.readAsText(file);
  });
};
