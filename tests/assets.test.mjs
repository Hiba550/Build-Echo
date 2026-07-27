import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { VISUAL_SHAPES } from "../packs/behavior/scripts/lib/model.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resource = join(root, "packs", "resource");

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function cubeList(geometry) {
  return geometry.bones.flatMap((bone) => bone.cubes ?? []);
}

function axisBounds(geometry, axis) {
  const index = { x: 0, y: 1, z: 2 }[axis];
  const cubes = cubeList(geometry);
  return {
    minimum: Math.min(...cubes.map((cube) => cube.origin[index])),
    maximum: Math.max(...cubes.map((cube) => cube.origin[index] + cube.size[index]))
  };
}

function pngPixels(buffer) {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const pixels = [];
  for (let y = 0; y < height; y += 1) {
    assert.equal(raw[y * (width * 4 + 1)], 0, "Generated PNG rows must use the deterministic no-filter encoding.");
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const start = y * (width * 4 + 1) + 1 + x * 4;
      row.push([...raw.subarray(start, start + 4)]);
    }
    pixels.push(row);
  }
  return pixels;
}

test("every visual selector resolves to a non-empty authored geometry", async () => {
  const document = await json(join(resource, "models", "entity", "buildecho.geo.json"));
  const geometries = new Map(
    document["minecraft:geometry"].map((geometry) => [geometry.description.identifier, geometry])
  );
  for (const shape of VISUAL_SHAPES) {
    const geometry = geometries.get(`geometry.buildecho.${shape}`);
    assert.ok(geometry, shape);
    assert.ok(cubeList(geometry).length > 0, `${shape} must contain visible cuboids`);
    for (const cube of cubeList(geometry)) {
      for (const value of [...cube.origin, ...cube.size]) {
        assert.equal(Number.isFinite(value), true, `${shape} contains a non-finite cuboid value`);
      }
      assert.ok(cube.size.every((value) => value > 0), `${shape} contains a zero-volume cuboid`);
    }
  }
});

test("critical partial-block silhouettes occupy the correct vertical volume", async () => {
  const document = await json(join(resource, "models", "entity", "buildecho.geo.json"));
  const geometries = new Map(
    document["minecraft:geometry"].map((geometry) => [geometry.description.identifier, geometry])
  );
  const bottom = axisBounds(geometries.get("geometry.buildecho.slab_bottom"), "y");
  const top = axisBounds(geometries.get("geometry.buildecho.slab_top"), "y");
  const stair = axisBounds(geometries.get("geometry.buildecho.stair"), "y");
  assert.deepEqual(bottom, { minimum: 0, maximum: 8 });
  assert.deepEqual(top, { minimum: 8, maximum: 16 });
  assert.deepEqual(stair, { minimum: 0, maximum: 16 });
  for (let layer = 1; layer <= 8; layer += 1) {
    assert.deepEqual(
      axisBounds(geometries.get(`geometry.buildecho.snow_${layer}`), "y"),
      { minimum: 0, maximum: layer * 2 }
    );
  }
});

test("full-block holograms are authored as slender 3D edge beams, never face panes", async () => {
  const document = await json(join(resource, "models", "entity", "buildecho.geo.json"));
  const geometry = document["minecraft:geometry"].find(
    (item) => item.description.identifier === "geometry.buildecho.cube"
  );
  const beams = cubeList(geometry);
  assert.equal(beams.length, 12, "a cube outline must contain exactly twelve edge beams");
  for (const beam of beams) {
    const longAxes = beam.size.filter((value) => value > 0.75);
    const thinAxes = beam.size.filter((value) => value <= 0.75);
    assert.equal(longAxes.length, 1, "each outline cuboid must extend along exactly one edge");
    assert.equal(thinAxes.length, 2, "each outline cuboid must be thin on both cross axes");
  }
});

test("edge-beam textures stay luminous and give conflicts a distinct warm signal", async () => {
  const normal = pngPixels(await readFile(join(resource, "textures", "entity", "buildecho_echo.png")));
  const conflict = pngPixels(await readFile(join(resource, "textures", "entity", "buildecho_conflict.png")));
  assert.ok(normal[0][8][3] >= 250, "normal beam cap must remain readable in daylight");
  assert.ok(normal[8][8][3] >= 190, "normal beam shaft must remain continuously readable");
  assert.ok(normal[8][4][0] > normal[8][8][0], "normal beam must retain bright pulse bands");
  assert.ok(conflict[0][8][3] >= 250, "conflict beam cap must remain prominent");
  assert.ok(conflict[8][8][0] > normal[8][8][0] * 4, "conflicts must use a strongly distinct warm hue");
});
