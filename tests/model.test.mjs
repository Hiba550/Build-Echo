import assert from "node:assert/strict";
import test from "node:test";
import {
  deterministicRepairOrder,
  displayName,
  groupMaterials,
  isExcludedType,
  isPlainMatchingStack,
  locationKey,
  memoryAddress,
  normalizeIncident,
  parseLocationKey,
  requiredItemCount,
  safeJsonParse,
  signatureForBlocks,
  visualFor,
  VISUAL_SHAPES,
  visualShapeId
} from "../packs/behavior/scripts/lib/model.js";

test("location keys round-trip negative and positive coordinates", () => {
  const location = { x: -33, y: -17, z: 48 };
  assert.deepEqual(parseLocationKey(locationKey(location)), location);
});

test("renderer shape IDs stay bounded and fall back safely", () => {
  assert.equal(VISUAL_SHAPES.length, 79);
  assert.equal(visualShapeId("fallback"), 0);
  assert.equal(visualShapeId("rod"), 42);
  assert.equal(visualShapeId("cake_bitten"), 78);
  assert.equal(visualShapeId("unknown"), 0);
});

test("memory shards are deterministic and separate nearby 64-position buckets", () => {
  const a = memoryAddress("minecraft:overworld", { x: -1, y: -1, z: -1 });
  const b = memoryAddress("minecraft:overworld", { x: -1, y: -1, z: -1 });
  const c = memoryAddress("minecraft:overworld", { x: -1, y: -1, z: -5 });
  assert.deepEqual(a, b);
  assert.match(a.property, /^be:m:o:-1:-1:-1:/);
  assert.notDeepEqual(a, c);
});

test("forbidden, technical, container, block-entity, and custom IDs are excluded", () => {
  for (const typeId of [
    "minecraft:bedrock",
    "minecraft:command_block",
    "minecraft:chest",
    "minecraft:red_shulker_box",
    "minecraft:red_bed",
    "minecraft:bed",
    "minecraft:double_stone_block_slab",
    "minecraft:wheat",
    "minecraft:respawn_anchor",
    "thirdparty:block"
  ]) assert.equal(isExcludedType(typeId), true, typeId);
  assert.equal(isExcludedType("minecraft:stone_bricks"), false);
  assert.equal(isExcludedType("minecraft:oak_stairs"), false);
  assert.equal(isExcludedType("minecraft:snow_layer"), false);
});

test("visual catalogue preserves slab half and stair orientation", () => {
  const topSlab = visualFor({
    t: "minecraft:bamboo_mosaic_slab",
    s: { "minecraft:vertical_half": "top" }
  });
  assert.equal(topSlab.shape, "slab_top");
  const expectedYaw = [270, 90, 0, 180];
  for (let direction = 0; direction < 4; direction += 1) {
    const stair = visualFor({
      x: 0,
      y: 0,
      z: 0,
      t: "minecraft:bamboo_mosaic_stairs",
      s: { upside_down_bit: false, weirdo_direction: direction }
    });
    assert.equal(stair.shape, "stair");
    assert.equal(stair.yaw, expectedYaw[direction]);
  }
});

test("stair neighborhoods select inner, outer, and inverted corner silhouettes", () => {
  const center = {
    x: 0,
    y: 0,
    z: 0,
    t: "minecraft:oak_stairs",
    s: { upside_down_bit: false, weirdo_direction: 2 }
  };
  const outer = visualFor(center, new Map([
    ["0,0,1", {
      x: 0,
      y: 0,
      z: 1,
      t: "minecraft:oak_stairs",
      s: { upside_down_bit: false, weirdo_direction: 0 }
    }]
  ]));
  assert.equal(outer.shape, "stair_outer_left");

  const inner = visualFor({ ...center, s: { ...center.s, upside_down_bit: true } }, new Map([
    ["0,0,-1", {
      x: 0,
      y: 0,
      z: -1,
      t: "minecraft:oak_stairs",
      s: { upside_down_bit: true, weirdo_direction: 1 }
    }]
  ]));
  assert.equal(inner.shape, "stair_inner_right_top");
});

test("base vanilla IDs use their real non-cube families instead of cubes", () => {
  assert.equal(visualFor({ t: "minecraft:torch", s: {} }).shape, "torch_floor");
  assert.equal(visualFor({ t: "minecraft:trapdoor", s: { open_bit: false } }).shape, "trapdoor_bottom");
  assert.equal(visualFor({ t: "minecraft:carpet", s: {} }).shape, "carpet");
  assert.equal(visualFor({ t: "minecraft:fence_gate", s: { open_bit: true } }).shape, "fence_gate_open");
  assert.equal(visualFor({ t: "minecraft:fence", s: {} }).shape, "fence");
});

test("door open state changes the panel yaw without changing its silhouette family", () => {
  const closed = visualFor({
    t: "minecraft:oak_door",
    s: { "minecraft:cardinal_direction": "south", open_bit: false, door_hinge_bit: false }
  });
  const open = visualFor({
    t: "minecraft:oak_door",
    s: { "minecraft:cardinal_direction": "south", open_bit: true, door_hinge_bit: false }
  });
  assert.equal(closed.shape, "door");
  assert.equal(open.shape, "door");
  assert.notEqual(open.yaw, closed.yaw);
});

test("pane connections are derived from captured neighbors", () => {
  const center = { x: 0, y: 0, z: 0, t: "minecraft:glass_pane", s: {} };
  const neighbors = new Map([
    ["0,0,-1", { x: 0, y: 0, z: -1, t: "minecraft:glass_pane", s: {} }],
    ["1,0,0", { x: 1, y: 0, z: 0, t: "minecraft:glass", s: {} }]
  ]);
  const visual = visualFor(center, neighbors);
  assert.equal(visual.shape, "pane");
  assert.equal(visual.connections.north, true);
  assert.equal(visual.connections.east, true);
  assert.equal(visual.connections.south, false);
});

test("exact wall height states and redstone arms survive neighborhood rendering", () => {
  const wall = visualFor({
    x: 0,
    y: 0,
    z: 0,
    t: "minecraft:cobblestone_wall",
    s: {
      wall_connection_type_north: "tall",
      wall_connection_type_east: "short",
      wall_connection_type_south: "none",
      wall_connection_type_west: "none",
      wall_post_bit: false
    }
  });
  assert.equal(wall.connections.north, true);
  assert.equal(wall.connections.northTall, true);
  assert.equal(wall.connections.east, true);
  assert.equal(wall.connections.eastTall, false);
  assert.equal(wall.connections.post, false);

  const redstone = visualFor({
    x: 0,
    y: 0,
    z: 0,
    t: "minecraft:redstone_wire",
    s: {}
  }, new Map([
    ["0,0,-1", { x: 0, y: 0, z: -1, t: "minecraft:unpowered_repeater", s: {} }]
  ]));
  assert.equal(redstone.shape, "redstone");
  assert.equal(redstone.connections.north, true);
  assert.equal(redstone.connections.east, false);
});

test("standing signs, chains, rods, gates, snow, and mounted clusters preserve exposed states", () => {
  assert.equal(
    visualFor({ t: "minecraft:oak_standing_sign", s: { ground_sign_direction: 4 } }).yaw,
    90
  );
  assert.equal(visualFor({ t: "minecraft:copper_chain", s: { pillar_axis: "x" } }).shape, "chain_x");
  assert.equal(visualFor({ t: "minecraft:end_rod", s: { facing_direction: 2 } }).shape, "rod_z");
  assert.equal(
    visualFor({ t: "minecraft:oak_fence_gate", s: { open_bit: false } }).shape,
    "fence_gate_closed"
  );
  assert.equal(visualFor({ t: "minecraft:snow_layer", s: { height: 6 } }).shape, "snow_7");
  assert.equal(
    visualFor({ t: "minecraft:amethyst_cluster", s: { "minecraft:block_face": "north" } }).shape,
    "cluster_wall"
  );
});

test("approximate plant silhouettes stay honest and are not batch-supported", () => {
  const visual = visualFor({ t: "minecraft:oak_sapling", s: {} });
  assert.equal(visual.shape, "plant");
  assert.equal(visual.supported, false);
});

test("persisted incidents discard unsafe legacy entries and refresh stale visuals", () => {
  const normalized = normalizeIncident({
    id: "legacy",
    entries: [
      { x: 0, y: 64, z: 0, k: "stale", t: "minecraft:bed", s: {}, v: { shape: "cube" } },
      { x: 1, y: 64, z: 0, k: "stale", t: "minecraft:torch", s: {}, v: { shape: "cube" } },
      { x: 2, y: 64, z: 0, t: "minecraft:oak_stairs", s: { weirdo_direction: 1 } }
    ]
  });

  assert.equal(normalized.entries.length, 2);
  assert.equal(normalized.sanitized, 1);
  assert.equal(normalized.entries[0].k, "1,64,0");
  assert.equal(normalized.entries[0].v.shape, "torch_floor");
  assert.equal(normalized.entries[1].v.shape, "stair");
  assert.equal(normalized.entries[1].v.yaw, 90);
});

test("plain matching items reject named, lore-bearing, and non-stackable data", () => {
  const plain = {
    typeId: "minecraft:oak_stairs",
    amount: 2,
    isStackable: true,
    nameTag: undefined,
    getLore: () => [],
    getDynamicPropertyIds: () => []
  };
  assert.equal(isPlainMatchingStack(plain, "minecraft:oak_stairs"), true);
  assert.equal(isPlainMatchingStack({ ...plain, nameTag: "Roof piece" }, "minecraft:oak_stairs"), false);
  assert.equal(isPlainMatchingStack({ ...plain, getLore: () => ["special"] }, "minecraft:oak_stairs"), false);
  assert.equal(isPlainMatchingStack({ ...plain, isStackable: false }, "minecraft:oak_stairs"), false);
});

test("linked groups are charged once in material summaries", () => {
  const materials = groupMaterials([
    { i: "minecraft:oak_door", g: "d1", c: 1, status: "missing" },
    { i: "minecraft:oak_door", g: "d1", c: 0, status: "missing" },
    { i: "minecraft:stone_bricks", c: 1, status: "missing" }
  ]);
  assert.deepEqual(materials, [
    { typeId: "minecraft:oak_door", name: "Oak Door", count: 1 },
    { typeId: "minecraft:stone_bricks", name: "Stone Bricks", count: 1 }
  ]);
});

test("multi-item states contribute their exact material cost", () => {
  assert.equal(requiredItemCount("minecraft:snow_layer", { height: 5 }), 6);
  assert.equal(requiredItemCount("minecraft:snow_layer", { height: 99 }), 8);
  assert.equal(requiredItemCount("minecraft:stone_bricks", {}), 1);
  const materials = groupMaterials([
    { i: "minecraft:snow_layer", n: 6, c: 1, status: "missing" },
    { i: "minecraft:stone_bricks", n: 1, c: 1, status: "missing" }
  ]);
  assert.deepEqual(materials, [
    { typeId: "minecraft:snow_layer", name: "Snow Layer", count: 6 },
    { typeId: "minecraft:stone_bricks", name: "Stone Bricks", count: 1 }
  ]);
});

test("repair ordering places structure before attachments and redstone", () => {
  assert.ok(
    deterministicRepairOrder({ t: "minecraft:stone_bricks" }) <
    deterministicRepairOrder({ t: "minecraft:wall_torch" })
  );
  assert.ok(
    deterministicRepairOrder({ t: "minecraft:wall_torch" }) <
    deterministicRepairOrder({ t: "minecraft:redstone_wire" })
  );
});

test("explosion signatures are deterministic regardless of event block order", () => {
  const blocks = [
    { location: { x: 2, y: 3, z: 4 } },
    { location: { x: -1, y: 8, z: 0 } }
  ];
  assert.equal(signatureForBlocks(blocks), signatureForBlocks([...blocks].reverse()));
});

test("safe JSON parsing contains malformed persistence", () => {
  assert.deepEqual(safeJsonParse("{bad", { safe: true }), { safe: true });
  assert.equal(displayName("minecraft:polished_blackstone_bricks"), "Polished Blackstone Bricks");
});
