# FlexHeaders
### A lightweight yet powerful extension to modify HTTP headers on the fly.

Thank you for checking out the FlexHeaders Github! This is a personal project that I started both out of curiosity and want to create something better for my everyday use.

#### Getting started

##### Setup
To get setup you will first need the correct version of Node, I personally use [NVM](https://github.com/nvm-sh/nvm) but as long as you have correct version of node as defined in the `.nvmrc` file you should be good to go

Make sure to run `npm i` to install all the package sana dependancies

##### How to build

`npm run build` will build the extension into the `/build` directory, this will contain everything you need to get the extension working in Chrome

##### How to install the extension

I would recommend following this guide on how to get your local version of the extension into chrome: [Link Here](https://scoopbyte.net/how-to-create-your-own-google-chrome-extension/)

You will need to point it to your `/build` folder location as mentioned above

##### How to make/see changes

- Make your local changes and make sure to save all the files
- Run `npm run build` to generate the new verson of the app
- If you want to be 100% sure your changes are present in the browser you can update the application version in:
  - package.json
  - `public/manifest.json`

And the new version should appear within the app when you open it

##### Resetting settings

Use the options menu to select **Reset All Settings** if you want to clear all stored headers and filters.
