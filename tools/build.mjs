import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const release = resolve(root, "release");
const version = "1.0.0";

if (!release.startsWith(`${root}${sep}`)) {
  throw new Error(`Refusing to replace release path outside the project: ${release}`);
}
await rm(release, { recursive: true, force: true });
await mkdir(release, { recursive: true });

async function walk(directory, base = directory, filter = () => true) {
  const output = {};
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const info = await stat(path);
    if (!filter(path, info)) continue;
    if (info.isDirectory()) Object.assign(output, await walk(path, base, filter));
    else output[relative(base, path).replaceAll("\\", "/")] = new Uint8Array(await readFile(path));
  }
  return output;
}

function archive(files) {
  return Buffer.from(zipSync(files, { level: 9 }));
}

const behaviorFiles = await walk(join(root, "packs", "behavior"));
const resourceFiles = await walk(join(root, "packs", "resource"));
const behaviorPack = archive(behaviorFiles);
const resourcePack = archive(resourceFiles);
const behaviorName = `Build-Echo-BP-${version}.mcpack`;
const resourceName = `Build-Echo-RP-${version}.mcpack`;
const addonName = `Build-Echo-${version}.mcaddon`;

await writeFile(join(release, behaviorName), behaviorPack);
await writeFile(join(release, resourceName), resourcePack);
const addon = archive({
  [behaviorName]: new Uint8Array(behaviorPack),
  [resourceName]: new Uint8Array(resourcePack)
});
await writeFile(join(release, addonName), addon);

const sourceEntries = {};
const sourceRoots = ["packs", "tools", "tests", "docs"];
for (const directory of sourceRoots) {
  const absolute = join(root, directory);
  const entries = await walk(absolute, absolute);
  for (const [name, bytes] of Object.entries(entries)) {
    sourceEntries[`${directory}/${name}`] = bytes;
  }
}
for (const name of [
  "package.json",
  "package-lock.json",
  "jsconfig.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md"
]) {
  sourceEntries[name] = new Uint8Array(await readFile(join(root, name)));
}
const sourceName = `Build-Echo-${version}-source.zip`;
await writeFile(join(release, sourceName), archive(sourceEntries));

const releaseNames = [addonName, behaviorName, resourceName, sourceName];
const checksumLines = [];
for (const name of releaseNames) {
  const bytes = await readFile(join(release, name));
  checksumLines.push(`${createHash("sha256").update(bytes).digest("hex").toUpperCase()}  ${name}`);
}
await writeFile(join(release, "SHA256SUMS.txt"), `${checksumLines.join("\n")}\n`);

const summary = {
  version,
  builtAt: new Date().toISOString(),
  artifacts: releaseNames,
  behaviorFiles: Object.keys(behaviorFiles).length,
  resourceFiles: Object.keys(resourceFiles).length
};
await writeFile(join(release, "build-manifest.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Built ${addonName}, separate packs, editable source, and SHA-256 checksums.`);
