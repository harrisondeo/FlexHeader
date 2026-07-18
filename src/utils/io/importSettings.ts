import { z } from "zod";
import type { Dispatch, SetStateAction } from "react";
import type { AlertContextType } from "../../context/alertContext";
import { pageSchema, type PagesData } from "../domain/schemas";
import { normalizePage } from "../domain/headers";

const importedPayloadSchema = z
  .array(pageSchema)
  .min(1, "Imported file does not contain any pages.");

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
    reader.onload = (e) => {
      try {
        const result = e.target?.result;

        if (typeof result !== "string") {
          reject(new Error("Unable to read file contents."));
          return;
        }

        const parsed = importedPayloadSchema.parse(JSON.parse(result));

        // remap the ids to avoid conflicts
        setPagesData((prev) => {
          const importedPages = parsed.map(normalizePage).map((page) => ({
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

        alertContext.setAlert({
          alertType: "success",
          alertText: "Settings imported.",
          location: "bottom",
        });

        resolve();
      } catch (error) {
        const err =
          error instanceof z.ZodError
            ? new Error(
                "Invalid settings file. Please export settings from FlexHeaders and try again."
              )
            : error instanceof Error
              ? error
              : new Error("Failed to import settings.");

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
