# FlexHeaders
### A lightweight yet powerful extension to modify HTTP headers on the fly.

Thank you for checking out the FlexHeaders Github! This is a personal project that I started both out of curiosity and want to create something better for my everyday use.

#### Getting started

##### Setup
To get setup you will first need the correct version of Node, I personally use [NVM](https://github.com/nvm-sh/nvm) but as long as you have the correct version of node as defined in the `.nvmrc` file you should be good to go

Package management is handled with [Bun](https://bun.sh/), so make sure you have it installed. Once installed, run `bun install` to install all the project dependencies.

##### How to run locally

`bun run start` will run the extension in development mode. This is useful for iterating on UI/logic outside of the extension popup, but note that some Chrome-extension-specific APIs (e.g. `chrome.declarativeNetRequest`) will not function outside of a loaded extension, so you'll still want to load the `/build` output into Chrome for full end-to-end testing (see below).

##### How to build

`bun run build` will build the extension into the `/build` directory, this will contain everything you need to get the extension working in Chrome

##### How to add the extension to Chrome for testing

1. Run `bun run build` to generate a fresh `/build` directory
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** using the toggle in the top-right corner
4. Click **Load unpacked**
5. Select the `/build` directory produced in step 1
6. The FlexHeaders extension should now appear in your extensions list and toolbar - pin it for easy access

##### How to make/see changes

- Make your local changes and make sure to save all the files
- Run `bun run build` to generate the new version of the app
- Go back to `chrome://extensions` and click the refresh icon on the FlexHeaders card to reload the updated build
- If you want to be 100% sure your changes are present in the browser you can update the application version in:
  - `package.json`
  - `public/manifest.json`

And the new version should appear within the app when you open it

##### Running tests

`bun run test` will run the test suite via `craco test`
