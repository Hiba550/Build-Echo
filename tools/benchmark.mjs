import { performance } from "node:perf_hooks";
import {
  memoryAddress,
  visualFor
} from "../packs/behavior/scripts/lib/model.js";

function measure(name, iterations, callback) {
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) callback(index);
  const elapsedMs = performance.now() - start;
  return { name, iterations, elapsedMs: Number(elapsedMs.toFixed(3)), perOperationUs: Number((elapsedMs * 1000 / iterations).toFixed(3)) };
}

const neighborhood = new Map([
  ["0,64,-1", { x: 0, y: 64, z: -1, t: "minecraft:oak_stairs", s: { weirdo_direction: 3, upside_down_bit: false } }],
  ["1,64,0", { x: 1, y: 64, z: 0, t: "minecraft:glass", s: {} }]
]);

const results = [
  measure("memory-address", 100000, (index) => {
    memoryAddress("minecraft:overworld", { x: index - 50000, y: (index % 384) - 64, z: 50000 - index });
  }),
  measure("visual-classification", 100000, (index) => {
    visualFor({
      x: 0,
      y: 64,
      z: 0,
      t: index % 2 ? "minecraft:oak_stairs" : "minecraft:glass_pane",
      s: { weirdo_direction: index % 4, upside_down_bit: Boolean(index % 2) }
    }, neighborhood);
  }),
  measure("incident-serialization-80", 1000, () => {
    JSON.stringify({
      id: "bench",
      entries: Array.from({ length: 80 }, (_, index) => ({
        k: `${index},64,0`,
        x: index,
        y: 64,
        z: 0,
        t: "minecraft:oak_stairs",
        i: "minecraft:oak_stairs",
        s: { weirdo_direction: index % 4, upside_down_bit: Boolean(index % 2), waterlogged_bit: false },
        status: "missing"
      }))
    });
  })
];

console.log(JSON.stringify({ node: process.version, platform: `${process.platform}-${process.arch}`, results }, null, 2));
