# FlexHeaders AI Guidelines & Project Constraints

This document defines core guidelines, architectures, constraints, and testing procedures for the **FlexHeaders** browser extension. All AI agents must adhere to these guidelines to ensure the extension remains highly robust, efficient, and reliable.

---

## 1. Extension Goal and Philosophy

FlexHeaders is a lightweight, reliable, and privacy-respecting browser extension designed to modify HTTP request and response headers on the fly.
* **Robustness over Flashiness**: Do not introduce bloat, excessive animations, or unnecessary third-party packages. The extension must load fast and work reliably.
* **Performance**: The popup interface must load instantly (target: < 150ms).
* **Compact Layout**: The popup UI is constrained by browser panel size (maximum recommended: 800px width, 600px height). Design UI components to fit and scale correctly within a small popup view.

---

## 2. Technology Stack & Key Abstractions

* **Core**: React 19, TypeScript, Vanilla CSS (with custom variable-based dark mode and CSS modules).
* **Framework**: [WXT](https://wxt.dev/) (Web Extension Tools) for multi-browser support (Chrome/Firefox).
* **Validation**: Zod is used for runtime validation of pages, filters, and headers (`src/utils/settings.ts`).
* **Browser APIs**: Always use `webextension-polyfill` (`import browser from "webextension-polyfill"`) rather than direct global `chrome` references for better cross-browser compatibility.

---

## 3. Critical Constraints & Robustness Guidelines

### A. Storage Limits (The 8KB Sync Limit)
* **Problem**: Chrome `sync` storage has a strict limit of **8KB per item (key)**, and a **100KB total limit**.
* **Architecture**: FlexHeaders uses a distributed storage scheme where metadata (`SETTINGS_V3_META_KEY`) is stored separately, and each page is stored under a distinct key like `page_0`, `page_1`, etc.
* **Guideline**: 
  - Ensure that page configurations do not exceed storage limits. Keep user-created fields (like custom comments, custom header names, values, or filters) minimal.
  - Before writing or updating settings, check the item size using `getDataSizeInBytes(page)`.
  - Fail gracefully if a page configuration approaches or exceeds storage limits, alerting the user via the Alert system instead of failing silently.

### B. Declarative Net Request (DNR) Rules
* FlexHeaders translates user-defined page and filter configurations into Chrome/Firefox declarativeNetRequest dynamic rules (`src/background/rules.ts`).
* **DNR Limitations**:
  - Keep regex filters valid. Always validate expressions using `browser.declarativeNetRequest.isRegexSupported`.
  - URL pattern filters (`urlFilter`) must conform to the strict DNR syntax rules. Use the helper `isValidUrlFilter` from `src/utils/settings.ts` to validate them before saving.
  - Exclude rules (priority 2, remove header action) have precedence over Include rules (priority 1, set header action).

### C. Error Handling
* Any critical failure during settings saving, storage synchronization, or DNR rule application must be caught and logged via `addStoredError` (`src/utils/errors.ts`).
* Errors are displayed to the user in the settings panel and via the global React Alert component. Never swallow errors or let them fail silently in background threads.

---

## 4. Component & UI Styling Guidelines

* **Style System**: Styles are authored in Vanilla CSS (e.g. `src/App.css`, `src/index.css`). Use CSS variables (`var(--...)`) for colors, shadows, borders, and dark mode styling.
* **Dark Mode**: Dark mode is activated by appending the class `.darkmode` to the root `.app` container.
* **Hot Module Replacement**: Use `bun run dev:web` to iterate on the React UI inside a standalone browser window (`localhost:5173`). Storage is automatically mocked with `localStorage` in this mode.
* **Aesthetics**: Follow the existing professional, semi-flat, glassmorphism theme. Avoid heavy decorative elements or structural changes that could break popup responsive scaling.

---

## 5. Development & Testing Workflow

Always verify your changes using the workspace's comprehensive test suite:

### A. Running Tests
1. **Unit / Integration Tests**: 
   * Runs the Vitest test suite for settings parsing, rule compilation, and storage helpers.
   * Command: `bun run test`
2. **Rule Fixture Updates**:
   * If you modify the NetRequest rule building logic in `src/background/rules.ts`, you MUST update the snapshot/fixture tests.
   * Command: `bun run test:update-fixtures`
3. **E2E Tests**:
   * Playwright runs end-to-end tests by building the extension and loading it in a headed Chromium browser.
   * Command: `bun run test:e2e`
   * To debug interactively, run: `bun run test:e2e:ui`

### B. Key Testing Rules
* **Selectors**: E2E tests target interactive elements via `data-testid` attributes. If you change or add UI elements, verify you are not removing existing `data-testid` tags, and add them for new interactable controls.
* **Types**: Always verify there are no TypeScript issues before committing changes:
   * Command: `bun run typecheck`
