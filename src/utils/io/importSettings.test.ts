import { vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
  declarativeNetRequest: {
    isRegexSupported: vi.fn().mockResolvedValue({ isSupported: true }),
  },
}));

vi.mock('webextension-polyfill', () => ({
  default: browserMock,
  ...browserMock,
}));

import type { Dispatch, SetStateAction } from 'react';
import { importSettingsFile } from './importSettings';
import type { Page, PagesData } from '../domain/schemas';
import type { AlertContextType } from '../../context/alertContext';

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

  it('converts a ModHeader export into pages, imported disabled with warnings returned (not alerted)', async () => {
    let pagesData: PagesData = { pages: [], selectedPage: 0 };
    const setPagesData: Dispatch<SetStateAction<PagesData>> = vi.fn((updater) => {
      pagesData = typeof updater === 'function' ? updater(pagesData) : updater;
    });
    const alertContext = createAlertContext();

    const modHeaderExport = [
      {
        alwaysOn: false,
        title: 'Testing Env',
        headers: [{ appendMode: true, enabled: true, name: 'test', value: 'asdf', comment: 'Testing 2' }],
        urlFilters: [{ enabled: true, urlRegex: '.*://localhost:8080/.*' }],
        version: 2,
        hideComment: false,
      },
    ];
    const file = new File([JSON.stringify(modHeaderExport)], 'modheader-export.json', { type: 'application/json' });

    const { warnings } = await importSettingsFile(file, { setPagesData, alertContext });

    expect(pagesData.pages).toHaveLength(1);
    expect(pagesData.pages[0]).toMatchObject({
      name: 'Testing Env',
      enabled: false,
      headers: [expect.objectContaining({ headerName: 'test', headerValue: 'asdf' })],
      filters: [expect.objectContaining({ type: 'include', mode: 'regex', valid: true })],
    });
    expect(pagesData.pages[0].pageId).toBeTruthy();
    expect(warnings).toEqual([expect.stringContaining('append mode')]);
    expect(alertContext.setAlert).not.toHaveBeenCalled();
  });

  it('rejects a file that matches neither FlexHeader nor ModHeader shape', async () => {
    const setPagesData = vi.fn();
    const alertContext = createAlertContext();
    const file = new File([JSON.stringify([{ foo: 'bar' }])], 'export.json', { type: 'application/json' });

    await expect(importSettingsFile(file, { setPagesData, alertContext })).rejects.toThrow(
      /FlexHeader or ModHeader/
    );
    expect(setPagesData).not.toHaveBeenCalled();
  });
});
