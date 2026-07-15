# Contributing to FlexHeaders

Thank you for your interest in contributing! This document covers how to set up the project locally, run tests, and prepare a pull request.

## Prerequisites

- **Node.js** — use the version specified in [`.nvmrc`](.nvmrc). [NVM](https://github.com/nvm-sh/nvm) is recommended.
- **Bun** — package management and scripts use [Bun](https://bun.sh/).
- **Git** — the release script uses Git tags.

## Setting up the project

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   bun install
   ```
   This also runs `wxt prepare` to generate WXT's TypeScript declarations.

## Development workflow

### Running locally

Use the WXT dev server for the browser you are targeting:

```bash
# Chrome
bun run start

# Firefox (MV3)
bun run start:firefox
```

WXT will rebuild the extension incrementally and reload it in the browser when possible.

### Building manually

```bash
bun run build:chrome   # outputs to dist/chrome
bun run build:firefox  # outputs to dist/firefox
bun run build          # builds both
```

To load the extension manually for testing:

- **Chrome**: go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `dist/chrome`.
- **Firefox**: go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on...**, and select `dist/firefox/manifest.json`.

### Type checking

Run TypeScript without emitting files:

```bash
bun run typecheck
```

## Testing

### Unit and integration tests

The Vitest suite covers background logic, utilities, and React components in a jsdom environment.

```bash
bun run test
```

Some background tests compare the generated `declarativeNetRequest` rules against committed fixtures. If you intentionally change rule generation, update the fixtures with:

```bash
bun run test:update-fixtures
```

### End-to-end tests

The E2E suite uses Playwright to load the real built Chrome extension and exercise the popup UI.

1. Install the Playwright Chromium browser (one-time):
   ```bash
   bun run test:e2e:install
   ```
2. Run the E2E tests:
   ```bash
   bun run test:e2e
   ```
   This automatically builds the Chrome extension first via the `pretest:e2e` script.
3. For an interactive debugging UI:
   ```bash
   bun run test:e2e:ui
   ```

Notes:
- Chrome extension loading requires a headed browser, so tests run with `headless: false`.
- Tests navigate to `chrome-extension://<id>/app.html?flexheader-popup=1` to force the popup layout.
- Selectors rely on `data-testid` attributes. If you change the UI, update the corresponding `data-testid`s in the components or tests.
- A local HTTP server (`e2e/server.mjs`) is started automatically for tests that verify headers are actually modified by `declarativeNetRequest`.

### Manual testing checklist

Before opening a pull request that touches UI or header logic, please verify at least the following manually:

- [ ] Create, edit, and delete request and response headers.
- [ ] Reorder headers using drag-and-drop.
- [ ] Apply include and exclude filters to headers.
- [ ] Confirm headers are applied to matching network requests.
- [ ] Export and import settings via JSON.
- [ ] Load the extension in Chrome and Firefox and confirm the popup/options page renders without errors.

## Before submitting a pull request

1. **Branch from `main`** and give your branch a descriptive name.
2. **Write or update tests** for the behaviour you changed.
3. **Run the full test suite** locally:
   ```bash
   bun run typecheck
   bun run test
   bun run test:e2e
   ```
   E2E tests require a graphical environment because they load the extension in a real browser.
4. **Update documentation** if your change affects usage, commands, or filter syntax.
5. **Bump the version** in `package.json` only if you are preparing a release; otherwise leave versioning to the maintainers.
6. **Keep commits focused** and write clear commit messages.

## Release process

The `release` script is used to cut a new release. It:

1. Verifies the current version in `package.json` is greater than the latest `v*` tag on `origin/main`.
2. Builds both Chrome and Firefox variants.
3. Creates versioned ZIPs in `builds/`.

Do not run this in a pull request; it is intended for maintainers on `main`.

## Code conventions

- **TypeScript** — prefer strict typing; avoid implicit `any`.
- **React components** — keep components focused; place shared UI in `src/components/`.
- **Extension logic** — background/service-worker code lives in `src/background/`.
- **Styling** — use the project's existing CSS files (`App.css`, `index.css`).
- **Testing** — prefer `data-testid` attributes for selectors in both unit and E2E tests.

## Questions?

Open a GitHub issue in this repository or start a discussion if anything is unclear. We are happy to help.
