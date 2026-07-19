# FlexHeaders
### A lightweight yet powerful extension to modify HTTP headers on the fly.

Thank you for checking out the FlexHeaders Github! This is a personal project that I started both out of curiosity and want to create something better for my everyday use.

Install from the [Chrome Webstore](https://chromewebstore.google.com/detail/gffpeamhhldhibdngenbfciboinanppf?utm_source=item-share-cb) for free

<img width="1400" height="560" alt="marquee" src="https://github.com/user-attachments/assets/ad610565-8ca8-4a01-bcbc-851a5f5dcb89" />

#### Storage architecture

Settings are split across local and sync storage with a merge/tombstone
system behind them. If you're wondering why it's not a single
`storage.set(data)` call, see [docs/storage-architecture.md](docs/storage-architecture.md).

#### Filter syntax

Filters can match URLs using either Regex or URL pattern syntax. See [docs/filter-rule-syntax.md](docs/filter-rule-syntax.md) for full details.

#### Getting started

##### Setup
To get setup you will first need the correct version of Node, I personally use [NVM](https://github.com/nvm-sh/nvm) but as long as you have the correct version of node as defined in the `.nvmrc` file you should be good to go

Package management is handled with [Bun](https://bun.sh/), so make sure you have it installed. Once installed, run `bun install` to install all the project dependencies and prepare WXT's generated types.

##### Available scripts

The project uses [WXT](https://wxt.dev/) to build, develop and package the browser extension. The main commands are:

| Command | What it does |
| --- | --- |
| `bun run start` | Start the WXT development server for Chrome. Builds incrementally and opens the default browser with the extension loaded when possible. |
| `bun run start:firefox` | Start the WXT development server for Firefox (MV3). |
| `bun run dev:web` | Run the React UI as a standalone web app with Vite HMR. Useful for rapid UI iteration; extension APIs are mocked. |
| `bun run build:chrome` | Build a production version of the Chrome extension into `dist/chrome`. |
| `bun run build:firefox` | Build a production version of the Firefox extension into `dist/firefox`. |
| `bun run build` | Build both the Chrome and Firefox extensions. |
| `bun run package` | Build both browsers and create ZIPs for distribution in `builds/`. |
| `bun run release` | Verify the version has been bumped, then build and package both extensions. |
| `bun run test` | Run the unit/integration test suite with Vitest. |
| `bun run test:update-fixtures` | Update the background script test fixtures from the current declarativeNetRequest rules. |
| `bun run test:e2e:install` | Install the Playwright Chromium browser (one-time setup). |
| `bun run test:e2e` | Build the Chrome extension and run the Playwright end-to-end tests. |
| `bun run test:e2e:ui` | Run the Playwright tests in the interactive UI mode. |
| `bun run typecheck` | Run TypeScript type checking without emitting files. |

##### How to run locally

`bun run start` runs the extension in development mode for Chrome. WXT watches source files, rebuilds incrementally and reloads the extension in the browser when possible. This is useful for iterating on UI/logic, but note that some Chrome-extension-specific APIs (e.g. `chrome.declarativeNetRequest`) will only function when the extension is loaded in a real browser.

For Firefox use `bun run start:firefox`.

##### Running the UI in a browser for rapid UI changes

`bun run dev:web` starts a standalone Vite dev server at `http://localhost:5173`. The extension's browser APIs are mocked and storage is backed by `localStorage`, so you get hot-module replacement and can iterate on the React UI without loading the extension into Chrome.

- The default opened URL includes `?flexheader-popup=1`, which forces the popup layout (reusing the same query parameter trick the E2E tests use).
- Navigate to the root URL without the query parameter to view the full-page options/settings layout.
- Extension-only features such as `declarativeNetRequest` and the background service worker do not run in this mode, so header modification cannot be tested here. Use `bun run start` or the E2E suite for that.

##### How to build

`bun run build` will build the extension for both browsers:

- Chrome output in `dist/chrome`
- Firefox output in `dist/firefox`

##### How to add the extension to Chrome for testing

1. Run `bun run build:chrome` to generate a fresh `dist/chrome` directory.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the `dist/chrome` directory produced in step 1.
6. The FlexHeaders extension should now appear in your extensions list and toolbar - pin it for easy access.

##### How to add the extension to Firefox for testing

1. Run `bun run build:firefox` to generate a Firefox-compatible `dist/firefox` directory.
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. In the file picker, open the `dist/firefox` directory and select `manifest.json`.
5. The FlexHeaders extension should now appear under **Temporary Extensions** and in the toolbar.

Note: Temporary add-ons are removed when Firefox is closed, so repeat the steps above after restarting Firefox.

##### How to package for distribution

Use `bun run package` to build and ZIP both browser variants into the `builds/` directory:

- `builds/v{version}.zip` — Chrome build
- `builds/v{version}-firefox.zip` — Firefox build

These ZIPs have `manifest.json` at the root, so they are ready for upload to the Chrome Web Store and Firefox Add-ons store. Zipping the `dist/` directory directly would nest `manifest.json` and the upload would fail.

##### How to make/see changes

- Make your local changes and save all files.
- If the dev server is running, WXT will rebuild and reload the extension automatically.
- If you are using a manual build, run `bun run build` to generate the new version of the extension.
- Go back to `chrome://extensions` and click the refresh icon on the FlexHeaders card to reload the updated build.
- If you want to be 100% sure your changes are present in the browser you can update the application version in `package.json` and the new version should appear within the app when you open it.

##### Running tests

`bun run test` will run the unit/integration test suite via Vitest.

##### Running end-to-end tests

The E2E suite uses Playwright to load the real built Chrome extension and drive the popup UI.

1. Install the Playwright Chromium browser (one-time):
   ```bash
   bun run test:e2e:install
   ```
2. Run the E2E tests:
   ```bash
   bun run test:e2e
   ```
   This builds the Chrome extension first (`bun run build:chrome`) and then launches Playwright.
3. For an interactive debugging UI:
   ```bash
   bun run test:e2e:ui
   ```

Notes:
- Chrome extension loading requires a headed browser, so the tests run with `headless: false`.
- Tests navigate to `chrome-extension://<id>/app.html?flexheader-popup=1` to force the popup layout in a tab.
- Selectors use `data-testid` attributes; update the attributes in the React components if the UI changes.
- A local HTTP server (`e2e/server.mjs`) is started automatically for tests that assert headers are really modified by `declarativeNetRequest`.
