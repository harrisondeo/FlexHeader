#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const buildsDir = join(root, "builds");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const packageVersion = pkg.version;

console.log(`\nFlexHeader v${packageVersion} — build & package\n`);

function run(label, cmd, args, options = {}) {
  console.log(`\n[${label}] $ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: root,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status ?? result.signal}: ${cmd} ${args.join(" ")}`
    );
  }
}

// 1. Build Chrome extension
run("build:chrome", "bun", ["run", "build:chrome"]);

// 2. Build Firefox extension (WXT generates its own manifest, targeting MV3)
run("build:firefox", "bun", ["run", "build:firefox"]);

// 3. Ensure output directory exists
mkdirSync(buildsDir, { recursive: true });

// 4. Package Chrome build: builds/v{version}.zip
const chromeZip = join(buildsDir, `v${packageVersion}.zip`);
run("package:chrome", "rm", ["-f", chromeZip]);
run(
  "package:chrome",
  "sh",
  [`-c`, `cd dist/chrome && zip -r "${chromeZip}" . -x '*.DS_Store'`],
  { cwd: root }
);

// 5. Package Firefox build: builds/v{version}-firefox.zip
const firefoxZip = join(buildsDir, `v${packageVersion}-firefox.zip`);
run("package:firefox", "rm", ["-f", firefoxZip]);
run(
  "package:firefox",
  "sh",
  [`-c`, `cd dist/firefox && zip -r "${firefoxZip}" . -x '*.DS_Store'`],
  { cwd: root }
);

console.log(`\nPackaging complete:`);
console.log(`  ${chromeZip}`);
console.log(`  ${firefoxZip}\n`);

