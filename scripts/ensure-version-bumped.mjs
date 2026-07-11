#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || "";
    throw new Error(
      `Command failed: ${cmd} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`
    );
  }

  return result.stdout?.trim() || "";
}

function parseSemver(version) {
  const [major, minor, patch] = version
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  return { major, minor, patch };
}

function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

const currentBranch = run("git", ["branch", "--show-current"]);
console.log(`Current branch: ${currentBranch || "(detached HEAD)"}`);

console.log("Fetching latest from origin...");
run("git", ["fetch", "origin"]);

if (currentBranch === "main") {
  console.log("Pulling latest main...");
  run("git", ["pull", "origin", "main"]);
} else {
  console.warn(
    "Not on main branch; skipping pull. Run this from main to release from the latest commit."
  );
}

const latestTag = run("git", [
  "describe",
  "--tags",
  "--abbrev=0",
  "origin/main",
  "--match",
  "v*",
]);

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const currentVersion = pkg.version;

console.log(`Latest release (tag): ${latestTag || "none"}`);
console.log(`Current version:      v${currentVersion}`);

if (!latestTag) {
  console.log("No previous release tag found. Proceeding with first release.");
  process.exit(0);
}

const comparison = compareSemver(
  parseSemver(currentVersion),
  parseSemver(latestTag)
);

if (comparison <= 0) {
  console.error(
    `\nRelease check failed: current version v${currentVersion} is not greater than the latest release ${latestTag}.`
  );
  console.error(
    "Bump the version in package.json and public/manifest.json before building a release."
  );
  process.exit(1);
}

console.log("Version has been bumped. Ready to build and package.\n");
