import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LIMITS, VISUAL_SHAPES } from "../packs/behavior/scripts/lib/model.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const behavior = join(root, "packs", "behavior");
const resource = join(root, "packs", "resource");
const failures = [];

async function filesUnder(directory) {
  const output = [];
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const info = await stat(path);
    if (info.isDirectory()) output.push(...await filesUnder(path));
    else output.push(path);
  }
  return output;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function json(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    failures.push(`${relative(root, path)} is not strict JSON: ${error.message}`);
    return undefined;
  }
}

const allFiles = [...await filesUnder(behavior), ...await filesUnder(resource)];
for (const path of allFiles.filter((value) => extname(value) === ".json")) await json(path);

const bp = await json(join(behavior, "manifest.json"));
const rp = await json(join(resource, "manifest.json"));
assert(bp?.format_version === 2, "Behavior manifest must use stable manifest v2.");
assert(rp?.format_version === 2, "Resource manifest must use stable manifest v2.");
assert(JSON.stringify(bp?.header?.min_engine_version) === "[1,26,30]", "Behavior min engine must be 1.26.30.");
assert(JSON.stringify(rp?.header?.min_engine_version) === "[1,26,30]", "Resource min engine must be 1.26.30.");
assert(bp?.dependencies?.some((item) => item.module_name === "@minecraft/server" && item.version === "2.8.0"), "Missing stable server 2.8.0 dependency.");
assert(bp?.dependencies?.some((item) => item.module_name === "@minecraft/server-ui" && item.version === "2.1.0"), "Missing stable server-ui 2.1.0 dependency.");
assert(bp?.dependencies?.some((item) => item.uuid === rp?.header?.uuid), "Behavior pack must depend on the resource-pack header UUID.");

const uuids = [
  bp?.header?.uuid,
  ...((bp?.modules ?? []).map((item) => item.uuid)),
  rp?.header?.uuid,
  ...((rp?.modules ?? []).map((item) => item.uuid))
].filter(Boolean);
assert(new Set(uuids).size === uuids.length, "Manifest UUIDs must all be unique.");

const echoBehavior = await json(join(behavior, "entities", "echo.behavior.json"));
const shapeProperty = echoBehavior?.["minecraft:entity"]?.description?.properties?.["buildecho:shape_id"];
const shapeValues = [...VISUAL_SHAPES];
assert(shapeProperty?.type === "int", "Shape selector must use a synced integer property.");
assert(JSON.stringify(shapeProperty?.range) === JSON.stringify([0, shapeValues.length - 1]), "Shape property range must cover every renderer geometry.");
assert(shapeProperty?.default === 0 && shapeProperty?.client_sync === true, "Shape property must default to fallback and sync to clients.");
assert(
  LIMITS.visiblePerDimension >= LIMITS.incidentBlocks,
  "Renderer cap must not silently hide entries from a maximum-size single incident."
);
for (const direction of ["north", "east", "south", "west"]) {
  const property = echoBehavior?.["minecraft:entity"]?.description?.properties?.[`buildecho:${direction}_tall`];
  assert(property?.type === "bool" && property?.client_sync === true, `Missing synced ${direction} wall-height property.`);
}
const echoClient = await json(join(resource, "entity", "echo.entity.json"));
const geometryRefs = echoClient?.["minecraft:client_entity"]?.description?.geometry ?? {};
for (const shape of shapeValues) assert(Boolean(geometryRefs[shape]), `Missing client geometry reference for shape ${shape}.`);

const geometryDocument = await json(join(resource, "models", "entity", "buildecho.geo.json"));
const geometryIds = new Set((geometryDocument?.["minecraft:geometry"] ?? []).map((item) => item.description?.identifier));
for (const [name, id] of Object.entries(geometryRefs)) assert(geometryIds.has(id), `Geometry ${name} references absent identifier ${id}.`);
assert(geometryIds.has("geometry.buildecho.core"), "Core geometry is absent.");

const renderController = await json(join(resource, "render_controllers", "echo.render_controllers.json"));
const renderText = JSON.stringify(renderController);
assert(renderText.includes("buildecho:shape_id"), "Render controller does not select the synced shape ID.");
assert(renderText.includes("buildecho:conflict"), "Conflict texture selection is absent.");
assert(renderText.includes("buildecho:north_tall"), "Exact tall wall-arm visibility is absent.");

for (const texture of ["buildecho_echo.png", "buildecho_conflict.png", "buildecho_core.png"]) {
  const buffer = await readFile(join(resource, "textures", "entity", texture));
  assert(buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${texture} is not a valid PNG stream.`);
}

const sourceFiles = [
  ...allFiles.filter((path) => [".js", ".json", ".lang"].includes(extname(path))),
  ...await filesUnder(join(root, "docs")),
  ...await filesUnder(join(root, "tools")),
  ...await filesUnder(join(root, "tests")).catch(() => [])
];
for (const path of sourceFiles) {
  const text = await readFile(path, "utf8");
  const developmentMarker = new RegExp("\\bTO" + "DO\\b|\\bFIX" + "ME\\b|sam" + "ple:|place" + "holder identifier", "i");
  assert(!developmentMarker.test(text), `${relative(root, path)} contains a forbidden development marker.`);
}

const main = await readFile(join(behavior, "scripts", "main.js"), "utf8");
for (const required of [
  "beforeEvents.explosion",
  "afterEvents.explosion",
  "playerPlaceBlock",
  "playerBreakBlock",
  "playerInteractWithEntity",
  "pistonActivate",
  "BlockPermutation.resolve",
  "getAllStates"
]) assert(main.includes(required), `main.js is missing required mechanism ${required}.`);
for (const forbidden of ["runCommand(", "setImpactedBlocks(", "clearDynamicProperties("]) {
  assert(!main.includes(forbidden), `main.js contains forbidden broad mutation ${forbidden}.`);
}

if (failures.length > 0) {
  console.error(`Validation failed with ${failures.length} problem(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${allFiles.length} pack files, ${shapeValues.length} renderer shapes, stable manifests, persistence guards, and safety mechanisms.`);
}
