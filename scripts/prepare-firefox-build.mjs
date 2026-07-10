import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const chromeBuildDir = join(projectRoot, "build");
const firefoxBuildDir = join(projectRoot, "build-firefox");
const chromeManifestPath = join(chromeBuildDir, "manifest.json");
const firefoxManifestPath = join(firefoxBuildDir, "manifest.json");

const chromeManifest = JSON.parse(readFileSync(chromeManifestPath, "utf8"));
const firefoxManifest = { ...chromeManifest };

if (firefoxManifest.background?.service_worker) {
  firefoxManifest.background = {
    scripts: [firefoxManifest.background.service_worker],
  };
}

rmSync(firefoxBuildDir, { force: true, recursive: true });
mkdirSync(firefoxBuildDir, { recursive: true });
cpSync(chromeBuildDir, firefoxBuildDir, { recursive: true });
writeFileSync(firefoxManifestPath, `${JSON.stringify(firefoxManifest, null, 2)}\n`);

console.log("Prepared Firefox build in ./build-firefox");
