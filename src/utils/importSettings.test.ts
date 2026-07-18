import { vi } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';
import { importSettingsFile } from './importSettings';
import type { Page, PagesData } from './schemas';
import type { AlertContextType } from '../context/alertContext';

// Regression coverage for a real bug: duplicating/importing a page carried
// over its source pageId, so mergePages (which matches by pageId) treated
// the import as "the same page, just edited" on another synced browser
// instead of a distinct new page.

const createPage = (id: number, name: string, enabled: boolean, pageId?: string): Page => ({
  id,
  pageId,
  name,
  enabled,
  keepEnabled: false,
  showHeaderComments: true,
  filtersExpanded: true,
  headers: [],
  filters: [],
});

const createAlertContext = (): AlertContextType => ({
  alertText: '',
  alertType: 'info',
  location: 'bottom',
  show: false,
  setAlert: vi.fn(),
});

describe('importSettingsFile', () => {
  it('always mints fresh pageIds, even when the file already has ones matching existing pages', async () => {
    let pagesData: PagesData = {
      pages: [createPage(0, 'Existing', true, 'existing-id')],
      selectedPage: 0,
    };
    const setPagesData: Dispatch<SetStateAction<PagesData>> = vi.fn((updater) => {
      pagesData = typeof updater === 'function' ? updater(pagesData) : updater;
    });
    const alertContext = createAlertContext();

    const importedPageWithClashingId: Page = {
      ...pagesData.pages[0],
      id: 0,
      name: 'Imported Copy',
    };
    const file = new File([JSON.stringify([importedPageWithClashingId])], 'export.json', { type: 'application/json' });

    await importSettingsFile(file, { setPagesData, alertContext });

    expect(pagesData.pages).toHaveLength(2);
    const pageIds = pagesData.pages.map((p) => p.pageId);
    expect(new Set(pageIds).size).toBe(pageIds.length); // no duplicates
    expect(alertContext.setAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: 'success' }));
  });

  it('rejects and surfaces an error alert for a file with no pages', async () => {
    const setPagesData = vi.fn();
    const alertContext = createAlertContext();
    const file = new File([JSON.stringify([])], 'export.json', { type: 'application/json' });

    await expect(importSettingsFile(file, { setPagesData, alertContext })).rejects.toThrow();
    expect(setPagesData).not.toHaveBeenCalled();
    expect(alertContext.setAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: 'error' }));
  });
});
