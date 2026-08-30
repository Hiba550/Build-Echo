export const SCHEMA_VERSION = 2;

export const VISUAL_SHAPES = Object.freeze([
  "fallback",
  "cube",
  "slab_bottom",
  "slab_top",
  "stair",
  "stair_top",
  "stair_inner_left",
  "stair_inner_right",
  "stair_outer_left",
  "stair_outer_right",
  "stair_inner_left_top",
  "stair_inner_right_top",
  "stair_outer_left_top",
  "stair_outer_right_top",
  "door",
  "trapdoor_bottom",
  "trapdoor_top",
  "trapdoor_open",
  "fence",
  "wall",
  "pane",
  "torch_floor",
  "torch_wall",
  "lantern",
  "lantern_hanging",
  "ladder",
  "button_floor",
  "button_wall",
  "button_ceiling",
  "lever_floor",
  "lever_wall",
  "lever_ceiling",
  "pressure_plate",
  "sign",
  "wall_sign",
  "hanging_sign",
  "rail_flat",
  "rail_slope",
  "rail_curve",
  "redstone",
  "carpet",
  "chain",
  "rod",
  "chain_x",
  "chain_z",
  "rod_x",
  "rod_z",
  "fence_gate_closed",
  "fence_gate_open",
  "snow_1",
  "snow_2",
  "snow_3",
  "snow_4",
  "snow_5",
  "snow_6",
  "snow_7",
  "snow_8",
  "campfire",
  "bell_floor",
  "bell_wall",
  "bell_ceiling",
  "scaffold",
  "anvil",
  "grindstone_floor",
  "grindstone_wall",
  "grindstone_ceiling",
  "stonecutter",
  "cactus",
  "cluster_floor",
  "cluster_wall",
  "cluster_ceiling",
  "dripstone_floor",
  "dripstone_ceiling",
  "plant",
  "repeater",
  "comparator",
  "sensor",
  "cake_full",
  "cake_bitten"
]);

const VISUAL_SHAPE_IDS = new Map(VISUAL_SHAPES.map((shape, index) => [shape, index]));

export function visualShapeId(shape) {
  return VISUAL_SHAPE_IDS.get(shape) ?? 0;
}

export function connectionMaskValue(connections = {}) {
  return (
    (connections.north ? 1 : 0) |
    (connections.east ? 2 : 0) |
    (connections.south ? 4 : 0) |
    (connections.west ? 8 : 0) |
    (connections.northTall ? 16 : 0) |
    (connections.eastTall ? 32 : 0) |
    (connections.southTall ? 64 : 0) |
    (connections.westTall ? 128 : 0) |
    (connections.post !== false ? 256 : 0)
  );
}

export const LIMITS = Object.freeze({
  incidentBlocks: 80,
  incidents: 64,
  visiblePerDimension: 80,
  visibleCoresPerDimension: 8,
  pendingExplosions: 16,
  renderRadius: 28,
  coreRadius: 40,
  targetDistance: 6,
  batchPerTick: 4,
  propertyChars: 30000,
  memoryShardPositions: 64,
  memoryShards: 128,
  memoryCacheShards: 24
});

const AIR_IDS = new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air"
]);

const FLUID_IDS = new Set([
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava"
]);

const FORBIDDEN_EXACT = new Set([
  "minecraft:air",
  "minecraft:bedrock",
  "minecraft:barrier",
  "minecraft:allow",
  "minecraft:deny",
  "minecraft:border_block",
  "minecraft:structure_block",
  "minecraft:structure_void",
  "minecraft:jigsaw",
  "minecraft:command_block",
  "minecraft:chain_command_block",
  "minecraft:repeating_command_block",
  "minecraft:end_portal",
  "minecraft:end_portal_frame",
  "minecraft:end_gateway",
  "minecraft:nether_portal",
  "minecraft:light_block",
  "minecraft:client_request_placeholder_block",
  "minecraft:unknown",
  "minecraft:sea_pickle",
  "minecraft:turtle_egg",
  "minecraft:pink_petals",
  "minecraft:leaf_litter",
  "minecraft:glow_lichen",
  "minecraft:sculk_vein",
  "minecraft:resin_clump",
  "minecraft:respawn_anchor",
  "minecraft:cauldron",
  "minecraft:composter",
  "minecraft:flower_pot",
  "minecraft:mob_spawner",
  "minecraft:trial_spawner",
  "minecraft:vault",
  "minecraft:suspicious_sand",
  "minecraft:suspicious_gravel",
  "minecraft:wheat",
  "minecraft:carrots",
  "minecraft:potatoes",
  "minecraft:beetroot",
  "minecraft:nether_wart",
  "minecraft:cocoa",
  "minecraft:melon_stem",
  "minecraft:pumpkin_stem",
  "minecraft:attached_melon_stem",
  "minecraft:attached_pumpkin_stem",
  "minecraft:torchflower_crop",
  "minecraft:pitcher_crop",
  "minecraft:sweet_berry_bush",
  "minecraft:cave_vines",
  "minecraft:cave_vines_body_with_berries",
  "minecraft:cave_vines_head_with_berries",
  "minecraft:sunflower",
  "minecraft:lilac",
  "minecraft:rose_bush",
  "minecraft:peony",
  "minecraft:tall_grass",
  "minecraft:large_fern",
  "minecraft:tall_dry_grass",
  "minecraft:tall_seagrass",
  "minecraft:pitcher_plant",
  "minecraft:big_dripleaf",
  "minecraft:small_dripleaf_block"
]);

const CONTAINER_EXACT = new Set([
  "minecraft:chest",
  "minecraft:trapped_chest",
  "minecraft:barrel",
  "minecraft:hopper",
  "minecraft:dispenser",
  "minecraft:dropper",
  "minecraft:furnace",
  "minecraft:lit_furnace",
  "minecraft:blast_furnace",
  "minecraft:lit_blast_furnace",
  "minecraft:smoker",
  "minecraft:lit_smoker",
  "minecraft:brewing_stand",
  "minecraft:jukebox",
  "minecraft:lectern",
  "minecraft:decorated_pot",
  "minecraft:chiseled_bookshelf",
  "minecraft:beehive",
  "minecraft:bee_nest",
  "minecraft:crafter"
]);

const UNSAFE_FAMILIES = [
  "shulker_box",
  "bed",
  "banner",
  "candle",
  "candle_cake",
  "skull",
  "head",
  "coral_fan",
  "coral_wall_fan",
  "cauldron",
  "crop",
  "stem",
  "vines",
  "vine"
];

const NON_CUBE_FAMILIES = [
  "stairs",
  "slab",
  "door",
  "trapdoor",
  "fence",
  "fence_gate",
  "wall",
  "pane",
  "torch",
  "wall_torch",
  "lantern",
  "ladder",
  "button",
  "pressure_plate",
  "sign",
  "standing_sign",
  "wall_sign",
  "hanging_sign",
  "rail",
  "carpet",
  "chain",
  "sapling",
  "flower",
  "mushroom",
  "roots",
  "vine",
  "crop",
  "amethyst_bud",
  "amethyst_cluster"
];

const NON_CUBE_EXACT = new Set([
  "minecraft:iron_bars",
  "minecraft:lever",
  "minecraft:rail",
  "minecraft:powered_rail",
  "minecraft:detector_rail",
  "minecraft:activator_rail",
  "minecraft:redstone_wire",
  "minecraft:unpowered_repeater",
  "minecraft:powered_repeater",
  "minecraft:unpowered_comparator",
  "minecraft:powered_comparator",
  "minecraft:chain",
  "minecraft:end_rod",
  "minecraft:lightning_rod",
  "minecraft:tripwire",
  "minecraft:tripwire_hook",
  "minecraft:scaffolding",
  "minecraft:snow_layer",
  "minecraft:flower_pot",
  "minecraft:cactus",
  "minecraft:cake",
  "minecraft:daylight_detector",
  "minecraft:daylight_detector_inverted",
  "minecraft:sculk_sensor",
  "minecraft:calibrated_sculk_sensor",
  "minecraft:amethyst_cluster",
  "minecraft:large_amethyst_bud",
  "minecraft:medium_amethyst_bud",
  "minecraft:small_amethyst_bud",
  "minecraft:pointed_dripstone",
  "minecraft:bell",
  "minecraft:campfire",
  "minecraft:soul_campfire",
  "minecraft:anvil",
  "minecraft:chipped_anvil",
  "minecraft:damaged_anvil",
  "minecraft:grindstone",
  "minecraft:stonecutter_block"
]);

const CARDINAL_YAW = Object.freeze({
  south: 0,
  west: 90,
  north: 180,
  east: 270
});

const CARDINAL_VECTOR = Object.freeze({
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
  north: { x: 0, z: -1 },
  east: { x: 1, z: 0 }
});

const WEIRDO_DIRECTION = Object.freeze({
  0: "east",
  1: "west",
  2: "south",
  3: "north"
});

const TRAPDOOR_DIRECTION = Object.freeze({
  0: "south",
  1: "north",
  2: "east",
  3: "west"
});

const FACING_DIRECTION = Object.freeze({
  0: "down",
  1: "up",
  2: "north",
  3: "south",
  4: "west",
  5: "east"
});

function blockPath(typeId) {
  return typeId.includes(":") ? typeId.split(":")[1] : typeId;
}

export function belongsToFamily(typeId, family) {
  const path = blockPath(typeId);
  return path === family || path.endsWith(`_${family}`);
}

function isAnyFamily(typeId, families) {
  return families.some((family) => belongsToFamily(typeId, family));
}

function floorDiv(value, divisor) {
  return Math.floor(value / divisor);
}

function positiveMod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function locationKey(location) {
  return `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
}

export function parseLocationKey(key) {
  const [x, y, z] = key.split(",").map(Number);
  return { x, y, z };
}

export function dimensionCode(dimensionId) {
  if (dimensionId.endsWith(":overworld") || dimensionId === "overworld") return "o";
  if (dimensionId.endsWith(":nether") || dimensionId === "nether") return "n";
  if (dimensionId.endsWith(":the_end") || dimensionId === "the_end") return "e";
  return `x${hashString(dimensionId).toString(36)}`;
}

export function memoryAddress(dimensionId, location) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  const z = Math.floor(location.z);
  const cx = floorDiv(x, 16);
  const cy = floorDiv(y, 16);
  const cz = floorDiv(z, 16);
  const lx = positiveMod(x, 16);
  const ly = positiveMod(y, 16);
  const lz = positiveMod(z, 16);
  const index = ly * 256 + lz * 16 + lx;
  const bucket = Math.floor(index / LIMITS.memoryShardPositions);
  const entry = positiveMod(index, LIMITS.memoryShardPositions).toString(36);
  return {
    property: `be:m:${dimensionCode(dimensionId)}:${cx}:${cy}:${cz}:${bucket}`,
    entry
  };
}

export function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function isAir(typeId) {
  return AIR_IDS.has(typeId);
}

export function isFluid(typeId) {
  return FLUID_IDS.has(typeId);
}

export function isExcludedType(typeId) {
  if (!typeId.startsWith("minecraft:")) return true;
  if (FORBIDDEN_EXACT.has(typeId) || CONTAINER_EXACT.has(typeId)) return true;
  const path = blockPath(typeId);
  if ((path.startsWith("double_") && path.includes("slab")) || path.includes("double_slab")) return true;
  return isAnyFamily(typeId, UNSAFE_FAMILIES);
}

export function hasNormalItem(permutation) {
  try {
    return permutation.getItemStack(1) !== undefined;
  } catch {
    return false;
  }
}

export function isKnownNonCube(typeId) {
  return NON_CUBE_EXACT.has(typeId) || isAnyFamily(typeId, NON_CUBE_FAMILIES);
}

export function displayName(typeId) {
  const path = typeId.includes(":") ? typeId.split(":")[1] : typeId;
  return path
    .split("_")
    .map((word) => word.length > 0 ? `${word[0].toUpperCase()}${word.slice(1)}` : word)
    .join(" ");
}

export function requiredItemCount(typeId, states = {}) {
  if (typeId === "minecraft:snow_layer") {
    return Math.max(1, Math.min(8, Number(states.height ?? 0) + 1));
  }
  return 1;
}

export function snapshotPermutation(block, memory) {
  const permutation = block.permutation;
  const prototype = permutation.getItemStack(1);
  if (!prototype) return undefined;
  return {
    k: locationKey(block.location),
    x: block.location.x,
    y: block.location.y,
    z: block.location.z,
    t: block.typeId,
    s: permutation.getAllStates(),
    i: prototype.typeId,
    o: memory.o,
    on: memory.on,
    g: memory.g,
    l: memory.l,
    c: memory.c ?? 1,
    n: memory.c === 0 ? 0 : requiredItemCount(block.typeId, permutation.getAllStates()),
    r: memory.r
  };
}

export function cardinalFromStates(states, typeId = "") {
  const direct = states["minecraft:cardinal_direction"] ?? states.cardinal_direction;
  if (typeof direct === "string" && CARDINAL_YAW[direct] !== undefined) return direct;

  if (belongsToFamily(typeId, "stairs")) {
    const value = states.weirdo_direction;
    if (typeof value === "number") return WEIRDO_DIRECTION[value] ?? "south";
  }

  if (belongsToFamily(typeId, "trapdoor")) {
    const value = states.direction;
    if (typeof value === "number") return TRAPDOOR_DIRECTION[value] ?? "south";
  }

  const facing = states.facing_direction ?? states["minecraft:facing_direction"];
  if (typeof facing === "string" && CARDINAL_YAW[facing] !== undefined) return facing;
  if (typeof facing === "number") {
    const direction = FACING_DIRECTION[facing];
    if (direction && CARDINAL_YAW[direction] !== undefined) return direction;
  }

  const torch = states.torch_facing_direction;
  if (typeof torch === "string" && CARDINAL_YAW[torch] !== undefined) return torch;
  return "south";
}

export function directionVector(direction) {
  return CARDINAL_VECTOR[direction] ?? CARDINAL_VECTOR.south;
}

export function yawForCardinal(direction) {
  return CARDINAL_YAW[direction] ?? 0;
}

function yawForSign(states) {
  const value = states.ground_sign_direction ?? states.rotation;
  if (typeof value === "number") return ((value % 16) + 16) % 16 * 22.5;
  return yawForCardinal(cardinalFromStates(states));
}

function axisFromStates(states, fallback = "y") {
  const axis = states.pillar_axis;
  if (axis === "x" || axis === "y" || axis === "z") return axis;
  const facing = states.facing_direction ?? states["minecraft:facing_direction"];
  const direction = typeof facing === "number" ? FACING_DIRECTION[facing] : facing;
  if (direction === "east" || direction === "west") return "x";
  if (direction === "north" || direction === "south") return "z";
  if (direction === "up" || direction === "down") return "y";
  return fallback;
}

function topHalf(states) {
  const verticalHalf = states["minecraft:vertical_half"];
  if (verticalHalf === "top") return true;
  if (verticalHalf === "bottom") return false;
  return Boolean(states.top_slot_bit ?? states.upside_down_bit);
}

function rotateLeft(direction) {
  return { south: "east", east: "north", north: "west", west: "south" }[direction] ?? "east";
}

function rotateRight(direction) {
  return { south: "west", west: "north", north: "east", east: "south" }[direction] ?? "west";
}

function opposite(direction) {
  return { south: "north", north: "south", east: "west", west: "east" }[direction] ?? "north";
}

function stateAt(neighborhood, location) {
  return neighborhood?.get(locationKey(location));
}

function step(location, direction) {
  const vector = directionVector(direction);
  return { x: location.x + vector.x, y: location.y, z: location.z + vector.z };
}

function sameStairHalf(a, b) {
  return topHalf(a?.s ?? {}) === topHalf(b?.s ?? {});
}

function stairShape(record, neighborhood) {
  const direct = record.s?.["minecraft:corner"] ?? record.s?.corner;
  if (["inner_left", "inner_right", "outer_left", "outer_right"].includes(direct)) return direct;
  const facing = cardinalFromStates(record.s, record.t);
  const front = stateAt(neighborhood, step(record, facing));
  if (front?.t && belongsToFamily(front.t, "stairs") && sameStairHalf(record, front)) {
    const frontFacing = cardinalFromStates(front.s, front.t);
    if (frontFacing === rotateLeft(facing)) return "outer_left";
    if (frontFacing === rotateRight(facing)) return "outer_right";
  }

  const back = stateAt(neighborhood, step(record, opposite(facing)));
  if (back?.t && belongsToFamily(back.t, "stairs") && sameStairHalf(record, back)) {
    const backFacing = cardinalFromStates(back.s, back.t);
    if (backFacing === rotateLeft(facing)) return "inner_left";
    if (backFacing === rotateRight(facing)) return "inner_right";
  }
  return "";
}

function connectionFamily(typeId) {
  if (typeId === "minecraft:iron_bars" || belongsToFamily(typeId, "pane")) return "pane";
  if (belongsToFamily(typeId, "fence") && !belongsToFamily(typeId, "fence_gate")) return "fence";
  if (belongsToFamily(typeId, "wall")) return "wall";
  if (typeId === "minecraft:redstone_wire") return "redstone";
  return "";
}

function canConnect(family, neighbor) {
  if (!neighbor || isAir(neighbor.t) || isFluid(neighbor.t)) return false;
  const neighborFamily = connectionFamily(neighbor.t);
  if (family === "pane") {
    return neighborFamily === "pane" || belongsToFamily(neighbor.t, "glass");
  }
  if (family === "fence") {
    return neighborFamily === "fence" || belongsToFamily(neighbor.t, "fence_gate") || !isKnownNonCube(neighbor.t);
  }
  if (family === "wall") {
    return neighborFamily === "wall" || !isKnownNonCube(neighbor.t);
  }
  if (family === "redstone") {
    return neighborFamily === "redstone" ||
      neighbor.t.includes("repeater") ||
      neighbor.t.includes("comparator") ||
      neighbor.t === "minecraft:observer" ||
      belongsToFamily(neighbor.t, "torch") ||
      neighbor.t === "minecraft:lever";
  }
  return false;
}

function connectionMask(record, neighborhood, family) {
  const connections = {
    north: false,
    east: false,
    south: false,
    west: false,
    northTall: false,
    eastTall: false,
    southTall: false,
    westTall: false,
    post: true
  };
  const states = record.s ?? {};
  for (const direction of ["north", "east", "south", "west"]) {
    const wallState = states[`wall_connection_type_${direction}`];
    const directState = states[`minecraft:connection_${direction}`];
    if (family === "wall" && typeof wallState === "string") {
      connections[direction] = wallState !== "none";
      connections[`${direction}Tall`] = wallState === "tall";
    } else if (typeof directState === "boolean") {
      connections[direction] = directState;
    } else {
      connections[direction] = canConnect(family, stateAt(neighborhood, step(record, direction)));
    }
  }
  const straightNorthSouth = connections.north && connections.south && !connections.east && !connections.west;
  const straightEastWest = connections.east && connections.west && !connections.north && !connections.south;
  if (family === "wall" && typeof states.wall_post_bit === "boolean") {
    connections.post = states.wall_post_bit;
  } else if (family === "wall") {
    connections.post = !straightNorthSouth && !straightEastWest;
  } else {
    connections.post = true;
  }
  return connections;
}

function leverPlacement(states) {
  const value = String(states.lever_direction ?? "");
  if (value.startsWith("down_")) return "floor";
  if (value.startsWith("up_")) return "ceiling";
  return "wall";
}

function buttonPlacement(states) {
  const facing = states.facing_direction ?? states["minecraft:facing_direction"];
  if (facing === 0) return "ceiling";
  if (facing === 1) return "floor";
  return "wall";
}

/**
 * @param {any} record
 * @param {Map<string, any>=} neighborhood
 */
export function visualFor(record, neighborhood) {
  const typeId = record.t;
  const states = record.s ?? {};
  const direction = cardinalFromStates(states, typeId);
  let yaw = yawForCardinal(direction);
  let shape = "cube";
  let supported = true;
  let connections = {
    north: false,
    east: false,
    south: false,
    west: false,
    northTall: false,
    eastTall: false,
    southTall: false,
    westTall: false,
    post: true
  };

  if (belongsToFamily(typeId, "stairs")) {
    const top = topHalf(states);
    const corner = stairShape(record, neighborhood);
    shape = `stair${corner ? `_${corner}` : ""}${top ? "_top" : ""}`;
  } else if (belongsToFamily(typeId, "slab")) {
    shape = topHalf(states) ? "slab_top" : "slab_bottom";
  } else if (belongsToFamily(typeId, "door") && !belongsToFamily(typeId, "trapdoor")) {
    shape = "door";
    if (Boolean(states.open_bit)) {
      yaw = (yaw + (Boolean(states.door_hinge_bit) ? 90 : 270)) % 360;
    }
  } else if (belongsToFamily(typeId, "trapdoor")) {
    if (Boolean(states.open_bit)) shape = "trapdoor_open";
    else shape = Boolean(states.upside_down_bit) ? "trapdoor_top" : "trapdoor_bottom";
  } else if (belongsToFamily(typeId, "fence_gate")) {
    shape = states.open_bit ? "fence_gate_open" : "fence_gate_closed";
  } else if (connectionFamily(typeId)) {
    shape = connectionFamily(typeId);
    connections = connectionMask(record, neighborhood, shape);
  } else if (belongsToFamily(typeId, "wall_torch")) {
    shape = "torch_wall";
  } else if (belongsToFamily(typeId, "torch")) {
    shape = "torch_floor";
  } else if (belongsToFamily(typeId, "lantern")) {
    shape = Boolean(states.hanging) ? "lantern_hanging" : "lantern";
  } else if (typeId === "minecraft:ladder") {
    shape = "ladder";
  } else if (belongsToFamily(typeId, "button")) {
    shape = `button_${buttonPlacement(states)}`;
  } else if (typeId === "minecraft:lever") {
    const placement = leverPlacement(states);
    shape = `lever_${placement}`;
    const leverDirection = String(states.lever_direction ?? "");
    const cardinal = ["north", "east", "south", "west"].find((value) => leverDirection.includes(value));
    if (cardinal) yaw = yawForCardinal(cardinal);
  } else if (belongsToFamily(typeId, "pressure_plate")) {
    shape = "pressure_plate";
  } else if (belongsToFamily(typeId, "hanging_sign")) {
    shape = "hanging_sign";
    yaw = yawForSign(states);
  } else if (belongsToFamily(typeId, "wall_sign")) {
    shape = "wall_sign";
  } else if (belongsToFamily(typeId, "sign")) {
    shape = "sign";
    yaw = yawForSign(states);
  } else if (belongsToFamily(typeId, "rail")) {
    const rail = Number(states.rail_direction ?? 0);
    shape = rail >= 2 && rail <= 5 ? "rail_slope" : rail >= 6 ? "rail_curve" : "rail_flat";
    yaw = [0, 90, 0, 180, 90, 270, 0, 90, 180, 270][rail] ?? 0;
  } else if (typeId.includes("repeater")) {
    shape = "repeater";
  } else if (typeId.includes("comparator")) {
    shape = "comparator";
  } else if (belongsToFamily(typeId, "carpet")) {
    shape = "carpet";
  } else if (belongsToFamily(typeId, "chain")) {
    const axis = axisFromStates(states);
    shape = axis === "x" ? "chain_x" : axis === "z" ? "chain_z" : "chain";
  } else if (belongsToFamily(typeId, "end_rod") || belongsToFamily(typeId, "lightning_rod")) {
    const axis = axisFromStates(states);
    shape = axis === "x" ? "rod_x" : axis === "z" ? "rod_z" : "rod";
  } else if (typeId === "minecraft:snow_layer") {
    const height = Math.max(0, Math.min(7, Number(states.height ?? 0)));
    shape = `snow_${height + 1}`;
  } else if (typeId === "minecraft:campfire" || typeId === "minecraft:soul_campfire") {
    shape = "campfire";
  } else if (typeId === "minecraft:bell") {
    const attachment = String(states.attachment ?? "");
    shape = attachment === "hanging"
      ? "bell_ceiling"
      : attachment.includes("side") || attachment.includes("wall")
        ? "bell_wall"
        : "bell_floor";
    const bellDirection = states.direction;
    if (typeof bellDirection === "number") yaw = yawForCardinal(TRAPDOOR_DIRECTION[bellDirection] ?? "south");
  } else if (typeId === "minecraft:scaffolding") {
    shape = "scaffold";
  } else if (typeId === "minecraft:anvil" || typeId === "minecraft:chipped_anvil" || typeId === "minecraft:damaged_anvil") {
    shape = "anvil";
  } else if (typeId === "minecraft:grindstone") {
    const attachment = String(states.attachment ?? "");
    shape = attachment === "hanging"
      ? "grindstone_ceiling"
      : attachment.includes("side") || attachment.includes("wall")
        ? "grindstone_wall"
        : "grindstone_floor";
    const grindstoneDirection = states.direction;
    if (typeof grindstoneDirection === "number") yaw = yawForCardinal(TRAPDOOR_DIRECTION[grindstoneDirection] ?? "south");
  } else if (typeId === "minecraft:stonecutter_block") {
    shape = "stonecutter";
  } else if (typeId === "minecraft:cactus") {
    shape = "cactus";
  } else if (
    typeId === "minecraft:amethyst_cluster" ||
    typeId === "minecraft:large_amethyst_bud" ||
    typeId === "minecraft:medium_amethyst_bud" ||
    typeId === "minecraft:small_amethyst_bud"
  ) {
    const face = String(states["minecraft:block_face"] ?? "up");
    shape = face === "down" ? "cluster_ceiling" : face === "up" ? "cluster_floor" : "cluster_wall";
    if (CARDINAL_YAW[face] !== undefined) yaw = yawForCardinal(face);
  } else if (typeId === "minecraft:pointed_dripstone") {
    shape = states.hanging ? "dripstone_ceiling" : "dripstone_floor";
  } else if (
    typeId === "minecraft:sculk_sensor" ||
    typeId === "minecraft:calibrated_sculk_sensor" ||
    typeId === "minecraft:daylight_detector" ||
    typeId === "minecraft:daylight_detector_inverted"
  ) {
    shape = "sensor";
  } else if (typeId === "minecraft:cake") {
    shape = Number(states.bite_counter ?? 0) > 0 ? "cake_bitten" : "cake_full";
  } else if (isAnyFamily(typeId, ["sapling", "flower", "mushroom", "roots"])) {
    shape = "plant";
    supported = false;
  } else if (isKnownNonCube(typeId)) {
    shape = "fallback";
    supported = false;
  }

  return { shape, yaw, connections, supported };
}

/**
 * Revalidates persisted incidents against the current safety and geometry rules.
 * This keeps worlds created with an older Build Echo build from rendering stale
 * cube fallbacks or restoring blocks that are no longer considered safe.
 *
 * @param {any} incident
 */
export function normalizeIncident(incident) {
  const sourceEntries = Array.isArray(incident?.entries) ? incident.entries : [];
  const entries = sourceEntries
    .filter((entry) => (
      entry &&
      typeof entry.t === "string" &&
      Number.isFinite(entry.x) &&
      Number.isFinite(entry.y) &&
      Number.isFinite(entry.z) &&
      !isExcludedType(entry.t)
    ))
    .map((entry) => ({
      ...entry,
      k: locationKey(entry)
    }));
  const neighborhood = new Map(entries.map((entry) => [entry.k, entry]));

  for (const entry of entries) {
    entry.v = visualFor(entry, neighborhood);
  }

  const removed = sourceEntries.length - entries.length;
  return {
    ...incident,
    v: SCHEMA_VERSION,
    entries,
    sanitized: Math.max(0, Number(incident?.sanitized ?? 0)) + removed
  };
}

export function isPlainMatchingStack(stack, typeId) {
  if (!stack || stack.typeId !== typeId || stack.amount < 1) return false;
  if (!stack.isStackable) return false;
  try {
    if (stack.nameTag) return false;
    if (stack.getLore().length > 0) return false;
    if (stack.getDynamicPropertyIds().length > 0) return false;
  } catch {
    return false;
  }
  return true;
}

export function signatureForBlocks(blocks) {
  return blocks.map((block) => locationKey(block.location)).sort().join("|");
}

export function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function deterministicRepairOrder(entry) {
  const typeId = entry.t;
  if (!isKnownNonCube(typeId) || belongsToFamily(typeId, "slab") || belongsToFamily(typeId, "stairs")) return 0;
  if (belongsToFamily(typeId, "door") && !belongsToFamily(typeId, "trapdoor")) {
    return entry.r === "upper" ? 2 : 1;
  }
  if (
    belongsToFamily(typeId, "fence") ||
    belongsToFamily(typeId, "wall") ||
    belongsToFamily(typeId, "pane")
  ) return 1;
  if (
    belongsToFamily(typeId, "torch") ||
    typeId === "minecraft:ladder" ||
    belongsToFamily(typeId, "button") ||
    typeId === "minecraft:lever"
  ) return 3;
  if (
    typeId.includes("redstone") ||
    typeId.includes("repeater") ||
    typeId.includes("comparator") ||
    belongsToFamily(typeId, "rail")
  ) return 4;
  return 2;
}

export function groupMaterials(entries) {
  const groups = new Map();
  const chargedGroups = new Set();
  for (const entry of entries) {
    if (entry.status === "restored" || entry.status === "dismissed") continue;
    if (entry.g && entry.c === 0) continue;
    if (entry.g && chargedGroups.has(entry.g)) continue;
    if (entry.g) chargedGroups.add(entry.g);
    groups.set(entry.i, (groups.get(entry.i) ?? 0) + Math.max(1, Number(entry.n ?? 1)));
  }
  return [...groups.entries()]
    .map(([typeId, count]) => ({ typeId, name: displayName(typeId), count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function safeJsonParse(value, fallback) {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
