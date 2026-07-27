import {
  BlockPermutation,
  EntityComponentTypes,
  GameMode,
  PlayerPermissionLevel,
  system,
  world
} from "@minecraft/server";
import {
  ActionFormData,
  MessageFormData
} from "@minecraft/server-ui";
import {
  LIMITS,
  SCHEMA_VERSION,
  belongsToFamily,
  cardinalFromStates,
  deterministicRepairOrder,
  directionVector,
  displayName,
  distanceSquared,
  groupMaterials,
  hashString,
  isAir,
  isExcludedType,
  isFluid,
  isPlainMatchingStack,
  locationKey,
  normalizeIncident,
  parseLocationKey,
  requiredItemCount,
  signatureForBlocks,
  snapshotPermutation,
  visualFor,
  visualShapeId
} from "./lib/model.js";
import { BuildEchoStore } from "./lib/storage.js";

const store = new BuildEchoStore();
const incidents = new Map();
const pendingExplosions = [];
const renderedEchoes = new Map();
const echoLookup = new Map();
const renderedCores = new Map();
const coreLookup = new Map();
const entryLocks = new Set();
const batchLocks = new Set();
const interactionTicks = new Map();
let incidentSequence = 0;
let ready = false;

function logError(context, error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[Build Echo] ${context}: ${message}`);
}

function safeRun(context, callback) {
  try {
    return callback();
  } catch (error) {
    logError(context, error);
    return undefined;
  }
}

function dimensionFromId(id) {
  return world.getDimension(id);
}

function copyLocation(location) {
  return { x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) };
}

function offset(location, direction, amount = 1) {
  const vector = directionVector(direction);
  return {
    x: location.x + vector.x * amount,
    y: location.y,
    z: location.z + vector.z * amount
  };
}

function opposite(direction) {
  return { north: "south", south: "north", east: "west", west: "east" }[direction] ?? "north";
}

function getBlock(dimension, location) {
  try {
    return dimension.getBlock(location);
  } catch {
    return undefined;
  }
}

function currentBlockRecord(dimension, location) {
  const block = getBlock(dimension, location);
  if (!block) return undefined;
  return { t: block.typeId, s: block.permutation.getAllStates(), ...copyLocation(location) };
}

function memoryFor(dimensionId, location) {
  return safeRun("read placement memory", () => store.getMemory(dimensionId, location));
}

function removeLinkedMemory(dimensionId, location) {
  const existing = memoryFor(dimensionId, location);
  store.removeMemory(dimensionId, location);
  if (!existing?.l || !Array.isArray(existing.l)) return;
  for (const linkedKey of existing.l) {
    store.removeMemory(dimensionId, parseLocationKey(linkedKey));
  }
}

function writePlacementMemory(dimension, block, player, group, links, charge, role) {
  if (isExcludedType(block.typeId)) {
    removeLinkedMemory(dimension.id, block.location);
    return;
  }
  const prototype = block.permutation.getItemStack(1);
  if (!prototype) {
    removeLinkedMemory(dimension.id, block.location);
    return;
  }
  const record = {
    t: block.typeId,
    s: block.permutation.getAllStates(),
    i: prototype.typeId,
    o: player.id,
    on: player.name,
    g: group,
    l: links,
    c: charge,
    n: charge === 0 ? 0 : requiredItemCount(block.typeId, block.permutation.getAllStates()),
    r: role
  };
  store.setMemory(dimension.id, block.location, record);
}

function recordPlacement(dimension, location, player) {
  const block = getBlock(dimension, location);
  if (!block) return;

  if (belongsToFamily(block.typeId, "door") && !belongsToFamily(block.typeId, "trapdoor")) {
    const states = block.permutation.getAllStates();
    const lowerLocation = {
      x: location.x,
      y: location.y - (states.upper_block_bit ? 1 : 0),
      z: location.z
    };
    const upperLocation = { x: lowerLocation.x, y: lowerLocation.y + 1, z: lowerLocation.z };
    const lower = getBlock(dimension, lowerLocation);
    const upper = getBlock(dimension, upperLocation);
    if (!lower || !upper || lower.typeId !== upper.typeId || !belongsToFamily(lower.typeId, "door")) {
      removeLinkedMemory(dimension.id, location);
      return;
    }
    const links = [locationKey(lowerLocation), locationKey(upperLocation)];
    const group = `d${hashString(`${dimension.id}|${links[0]}|${player.id}|${system.currentTick}`).toString(36)}`;
    writePlacementMemory(dimension, lower, player, group, links, 1, "lower");
    writePlacementMemory(dimension, upper, player, group, links, 0, "upper");
    return;
  }

  writePlacementMemory(dimension, block, player, undefined, undefined, 1, "single");
}

function refreshRememberedState(dimension, location, player) {
  const memory = memoryFor(dimension.id, location);
  if (!memory) return;
  if (memory.l && Array.isArray(memory.l)) {
    for (const key of memory.l) {
      const linkedLocation = parseLocationKey(key);
      const linkedBlock = getBlock(dimension, linkedLocation);
      if (!linkedBlock || isAir(linkedBlock.typeId)) continue;
      writePlacementMemory(
        dimension,
        linkedBlock,
        player,
        memory.g,
        memory.l,
        memory.r === "lower" ? 1 : (linkedBlock.permutation.getAllStates().upper_block_bit ? 0 : 1),
        linkedBlock.permutation.getAllStates().upper_block_bit ? "upper" : "lower"
      );
    }
    return;
  }
  const block = getBlock(dimension, location);
  if (!block || isAir(block.typeId)) return;
  writePlacementMemory(dimension, block, player, memory.g, memory.l, memory.c, memory.r);
}

function collectExplosionSnapshot(event) {
  const impacted = event.getImpactedBlocks();
  if (impacted.length === 0) return;
  const candidateBlocks = new Map();

  for (const block of impacted) {
    const memory = memoryFor(event.dimension.id, block.location);
    if (!memory) continue;
    candidateBlocks.set(locationKey(block.location), { block, memory });
    if (Array.isArray(memory.l)) {
      for (const linkedKey of memory.l) {
        const linkedLocation = parseLocationKey(linkedKey);
        const linkedMemory = memoryFor(event.dimension.id, linkedLocation);
        const linkedBlock = getBlock(event.dimension, linkedLocation);
        if (linkedMemory && linkedBlock && !isAir(linkedBlock.typeId)) {
          candidateBlocks.set(linkedKey, { block: linkedBlock, memory: linkedMemory });
        }
      }
    }
  }

  if (candidateBlocks.size === 0) return;
  const records = [];
  const neighborhood = new Map();
  for (const { block, memory } of candidateBlocks.values()) {
    if (isExcludedType(block.typeId)) continue;
    const snapshot = safeRun("snapshot explosion permutation", () => snapshotPermutation(block, memory));
    if (!snapshot) continue;
    records.push(snapshot);
  }
  if (records.length === 0) return;

  for (const record of records) {
    neighborhood.set(record.k, { t: record.t, s: record.s, x: record.x, y: record.y, z: record.z });
    for (const direction of ["north", "east", "south", "west"]) {
      const adjacentLocation = offset(record, direction);
      const key = locationKey(adjacentLocation);
      if (!neighborhood.has(key)) {
        const adjacent = currentBlockRecord(event.dimension, adjacentLocation);
        if (adjacent) neighborhood.set(key, adjacent);
      }
    }
  }

  pendingExplosions.push({
    tick: system.currentTick,
    dimensionId: event.dimension.id,
    signature: signatureForBlocks(impacted),
    source: event.source?.typeId ?? "unattributed",
    records,
    neighborhood
  });
}

function matchExplosion(event) {
  const signature = signatureForBlocks(event.getImpactedBlocks());
  const index = pendingExplosions.findIndex(
    (pending) => pending.dimensionId === event.dimension.id && pending.signature === signature
  );
  if (index < 0) return;
  const [pending] = pendingExplosions.splice(index, 1);
  system.runTimeout(() => finalizeExplosion(pending), 1);
}

function incidentCoreLocation(entries) {
  let x = 0;
  let z = 0;
  let maxY = -64;
  for (const entry of entries) {
    x += entry.x + 0.5;
    z += entry.z + 0.5;
    maxY = Math.max(maxY, entry.y);
  }
  return {
    x: x / entries.length,
    y: maxY + 1.25,
    z: z / entries.length
  };
}

function trimIncidentToStorage(incident) {
  const original = incident.entries.length;
  while (JSON.stringify(incident).length > LIMITS.propertyChars && incident.entries.length > 1) {
    incident.entries.pop();
  }
  incident.omitted = (incident.omitted ?? 0) + (original - incident.entries.length);
}

function finalizeExplosion(pending) {
  if (!ready || incidents.size >= LIMITS.incidents) return;
  const dimension = dimensionFromId(pending.dimensionId);
  const destroyed = [];

  for (const record of pending.records) {
    const block = getBlock(dimension, record);
    if (!block) continue;
    if (block.typeId === record.t) continue;
    const visual = visualFor(record, pending.neighborhood);
    destroyed.push({
      ...record,
      v: visual,
      status: isAir(block.typeId) ? "missing" : "conflict"
    });
  }
  if (destroyed.length === 0) return;

  const capped = destroyed.slice(0, LIMITS.incidentBlocks);
  const id = `${world.getAbsoluteTime().toString(36)}-${(incidentSequence += 1).toString(36)}`;
  const incident = {
    v: SCHEMA_VERSION,
    id,
    dimensionId: pending.dimensionId,
    source: pending.source,
    created: world.getAbsoluteTime(),
    visible: true,
    core: incidentCoreLocation(capped),
    entries: capped,
    omitted: Math.max(0, destroyed.length - capped.length)
  };
  trimIncidentToStorage(incident);
  for (const entry of destroyed) {
    store.removeMemory(pending.dimensionId, entry);
  }
  if (!store.saveIncident(incident)) {
    console.warn("[Build Echo] Incident was not saved because a safety cap was reached.");
    return;
  }

  incidents.set(id, incident);
  notifyFirstIncident(incident);
}

function notifyFirstIncident(incident) {
  const dimension = dimensionFromId(incident.dimensionId);
  for (const player of dimension.getPlayers({ location: incident.core, maxDistance: LIMITS.coreRadius })) {
    if (player.getDynamicProperty("be:first") === true) continue;
    player.setDynamicProperty("be:first", true);
    player.sendMessage("§bYour build left an echo. Bring the missing blocks to restore it.");
  }
}

function prunePendingExplosions() {
  const cutoff = system.currentTick - 20;
  for (let index = pendingExplosions.length - 1; index >= 0; index -= 1) {
    if (pendingExplosions[index].tick < cutoff) pendingExplosions.splice(index, 1);
  }
}

function isEntityValid(entity) {
  try {
    return entity.isValid;
  } catch {
    return false;
  }
}

function removeEntity(entity) {
  safeRun("remove renderer entity", () => {
    if (isEntityValid(entity)) entity.remove();
  });
}

function cleanupAllRenderers() {
  for (const dimensionId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    const dimension = dimensionFromId(dimensionId);
    for (const entity of dimension.getEntities({ families: ["buildecho"] })) {
      removeEntity(entity);
    }
  }
  renderedEchoes.clear();
  echoLookup.clear();
  renderedCores.clear();
  coreLookup.clear();
}

function entryConflict(incident, entry) {
  const block = getBlock(dimensionFromId(incident.dimensionId), entry);
  return !block || !isAir(block.typeId);
}

function setEchoProperties(entity, incident, entry) {
  const connections = entry.v?.connections ?? {};
  entity.setProperty("buildecho:shape_id", visualShapeId(entry.v?.shape));
  entity.setProperty("buildecho:north", Boolean(connections.north));
  entity.setProperty("buildecho:east", Boolean(connections.east));
  entity.setProperty("buildecho:south", Boolean(connections.south));
  entity.setProperty("buildecho:west", Boolean(connections.west));
  entity.setProperty("buildecho:north_tall", Boolean(connections.northTall));
  entity.setProperty("buildecho:east_tall", Boolean(connections.eastTall));
  entity.setProperty("buildecho:south_tall", Boolean(connections.southTall));
  entity.setProperty("buildecho:west_tall", Boolean(connections.westTall));
  entity.setProperty("buildecho:post", connections.post !== false);
  entity.setProperty("buildecho:conflict", entryConflict(incident, entry));
  entity.setRotation({ x: 0, y: entry.v?.yaw ?? 0 });
}

function spawnEcho(incident, entry) {
  const dimension = dimensionFromId(incident.dimensionId);
  const entity = dimension.spawnEntity("buildecho:echo", {
    x: entry.x + 0.5,
    y: entry.y,
    z: entry.z + 0.5
  });
  setEchoProperties(entity, incident, entry);
  entity.addTag("buildecho_runtime");
  return entity;
}

function spawnCore(incident) {
  const dimension = dimensionFromId(incident.dimensionId);
  const entity = dimension.spawnEntity("buildecho:core", incident.core);
  entity.addTag("buildecho_runtime");
  return entity;
}

function nearestPlayerDistanceSquared(players, location, radius) {
  const maximum = radius * radius;
  let nearest = Number.POSITIVE_INFINITY;
  for (const player of players) {
    const distance = distanceSquared(player.location, location);
    if (distance <= maximum && distance < nearest) nearest = distance;
  }
  return nearest;
}

function reconcileRenderers() {
  if (!ready) return;
  const wantedEchoes = new Set();
  const wantedCores = new Set();
  const candidates = new Map();
  const playerCache = new Map();

  for (const incident of incidents.values()) {
    let players = playerCache.get(incident.dimensionId);
    if (!players) {
      players = dimensionFromId(incident.dimensionId).getPlayers();
      playerCache.set(incident.dimensionId, players);
    }
    const coreDistance = nearestPlayerDistanceSquared(players, incident.core, LIMITS.coreRadius);
    if (Number.isFinite(coreDistance)) wantedCores.add(incident.id);
    if (!incident.visible) continue;
    for (const entry of incident.entries) {
      if (entry.status === "restored" || entry.status === "dismissed") continue;
      const distance = nearestPlayerDistanceSquared(players, entry, LIMITS.renderRadius);
      if (!Number.isFinite(distance)) continue;
      if (!candidates.has(incident.dimensionId)) candidates.set(incident.dimensionId, []);
      candidates.get(incident.dimensionId).push({
        renderKey: `${incident.id}|${entry.k}`,
        distance
      });
    }
  }

  for (const dimensionCandidates of candidates.values()) {
    dimensionCandidates
      .sort((a, b) => a.distance - b.distance || a.renderKey.localeCompare(b.renderKey))
      .slice(0, LIMITS.visiblePerDimension)
      .forEach((candidate) => wantedEchoes.add(candidate.renderKey));
  }

  for (const [renderKey, entity] of renderedEchoes) {
    if (!wantedEchoes.has(renderKey) || !isEntityValid(entity)) {
      echoLookup.delete(entity.id);
      removeEntity(entity);
      renderedEchoes.delete(renderKey);
    }
  }

  for (const renderKey of wantedEchoes) {
    const [incidentId, entryKey] = renderKey.split("|");
    const incident = incidents.get(incidentId);
    const entry = incident?.entries.find((value) => value.k === entryKey);
    if (!incident || !entry) continue;
    let entity = renderedEchoes.get(renderKey);
    if (!entity || !isEntityValid(entity)) {
      entity = safeRun("spawn echo renderer", () => spawnEcho(incident, entry));
      if (!entity) continue;
      renderedEchoes.set(renderKey, entity);
      echoLookup.set(entity.id, { incidentId, entryKey });
    } else {
      safeRun("refresh echo renderer", () => setEchoProperties(entity, incident, entry));
    }
  }

  for (const [incidentId, entity] of renderedCores) {
    if (!wantedCores.has(incidentId) || !isEntityValid(entity)) {
      coreLookup.delete(entity.id);
      removeEntity(entity);
      renderedCores.delete(incidentId);
    }
  }

  for (const incidentId of wantedCores) {
    if (renderedCores.has(incidentId) && isEntityValid(renderedCores.get(incidentId))) continue;
    const incident = incidents.get(incidentId);
    if (!incident) continue;
    const entity = safeRun("spawn echo core", () => spawnCore(incident));
    if (!entity) continue;
    renderedCores.set(incidentId, entity);
    coreLookup.set(entity.id, incidentId);
  }
}

function removeEntryRenderer(incidentId, entryKey) {
  const renderKey = `${incidentId}|${entryKey}`;
  const entity = renderedEchoes.get(renderKey);
  if (!entity) return;
  echoLookup.delete(entity.id);
  removeEntity(entity);
  renderedEchoes.delete(renderKey);
}

function removeIncidentRenderers(incidentId) {
  for (const [renderKey, entity] of renderedEchoes) {
    if (!renderKey.startsWith(`${incidentId}|`)) continue;
    echoLookup.delete(entity.id);
    removeEntity(entity);
    renderedEchoes.delete(renderKey);
  }
  const core = renderedCores.get(incidentId);
  if (core) {
    coreLookup.delete(core.id);
    removeEntity(core);
    renderedCores.delete(incidentId);
  }
}

function inventoryContainer(player) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory);
  return inventory?.container;
}

function matchingAmount(player, typeId, heldOnly) {
  const container = inventoryContainer(player);
  if (!container) return 0;
  if (heldOnly) {
    const slot = player.selectedSlotIndex;
    const stack = container.getItem(slot);
    return isPlainMatchingStack(stack, typeId) ? stack.amount : 0;
  }
  let amount = 0;
  for (let slot = 0; slot < container.size; slot += 1) {
    const stack = container.getItem(slot);
    if (isPlainMatchingStack(stack, typeId)) amount += stack.amount;
  }
  return amount;
}

function consumeItems(player, typeId, amount, heldOnly) {
  if (player.getGameMode() === GameMode.Creative) return true;
  const container = inventoryContainer(player);
  if (!container || matchingAmount(player, typeId, heldOnly) < amount) return false;
  const slots = heldOnly
    ? [player.selectedSlotIndex]
    : Array.from({ length: container.size }, (_, slot) => slot);
  const changed = [];
  let remaining = amount;
  try {
    for (const slot of slots) {
      if (remaining <= 0) break;
      const stack = container.getItem(slot);
      if (!stack || !isPlainMatchingStack(stack, typeId)) continue;
      changed.push({ slot, stack: stack.clone() });
      const taken = Math.min(remaining, stack.amount);
      remaining -= taken;
      if (taken === stack.amount) container.setItem(slot, undefined);
      else {
        stack.amount -= taken;
        container.setItem(slot, stack);
      }
    }
  } catch {
    for (const previous of changed) {
      safeRun("restore inventory after failed consumption", () => container.setItem(previous.slot, previous.stack));
    }
    return false;
  }
  if (remaining === 0) return true;
  for (const previous of changed) {
    safeRun("restore inventory after incomplete consumption", () => container.setItem(previous.slot, previous.stack));
  }
  return false;
}

function isPositionSafeForEntityPlacement(dimension, entry) {
  const center = { x: entry.x + 0.5, y: entry.y + 0.5, z: entry.z + 0.5 };
  for (const entity of dimension.getEntities({ location: center, maxDistance: 0.78 })) {
    if (entity.typeId === "buildecho:echo" || entity.typeId === "buildecho:core") continue;
    if (entity.typeId === "minecraft:item" || entity.typeId === "minecraft:xp_orb") continue;
    return false;
  }
  return true;
}

function supportLocation(entry) {
  const typeId = entry.t;
  const states = entry.s ?? {};
  if (belongsToFamily(typeId, "door") && !belongsToFamily(typeId, "trapdoor") && entry.r === "lower") {
    return { x: entry.x, y: entry.y - 1, z: entry.z };
  }
  if (
    belongsToFamily(typeId, "pressure_plate") ||
    belongsToFamily(typeId, "rail") ||
    typeId === "minecraft:redstone_wire" ||
    belongsToFamily(typeId, "carpet") ||
    typeId === "minecraft:snow_layer" ||
    typeId === "minecraft:campfire" ||
    typeId === "minecraft:soul_campfire" ||
    (belongsToFamily(typeId, "torch") && !belongsToFamily(typeId, "wall_torch"))
  ) {
    return { x: entry.x, y: entry.y - 1, z: entry.z };
  }
  if (
    typeId === "minecraft:ladder" ||
    belongsToFamily(typeId, "wall_torch") ||
    belongsToFamily(typeId, "wall_sign")
  ) {
    const facing = cardinalFromStates(states, typeId);
    return offset(entry, opposite(facing));
  }
  if (belongsToFamily(typeId, "button")) {
    const facing = states.facing_direction ?? states["minecraft:facing_direction"];
    if (facing === 0) return { x: entry.x, y: entry.y + 1, z: entry.z };
    if (facing === 1) return { x: entry.x, y: entry.y - 1, z: entry.z };
    return offset(entry, opposite(cardinalFromStates(states, typeId)));
  }
  if (typeId === "minecraft:lever") {
    const lever = String(states.lever_direction ?? "");
    if (lever.startsWith("down_")) return { x: entry.x, y: entry.y - 1, z: entry.z };
    if (lever.startsWith("up_")) return { x: entry.x, y: entry.y + 1, z: entry.z };
    const facing = ["north", "east", "south", "west"].find((value) => lever.includes(value)) ?? "south";
    return offset(entry, opposite(facing));
  }
  return undefined;
}

function supportIsValid(dimension, entry, transactionKeys) {
  const support = supportLocation(entry);
  if (!support) return true;
  if (transactionKeys.has(locationKey(support))) return true;
  const block = getBlock(dimension, support);
  return Boolean(block && !isAir(block.typeId) && !isFluid(block.typeId));
}

function transactionEntries(incident, selected) {
  if (!selected.g) return [selected];
  return incident.entries.filter(
    (entry) => entry.g === selected.g && entry.status !== "restored" && entry.status !== "dismissed"
  );
}

function rollbackPlaced(dimension, entries) {
  const air = BlockPermutation.resolve("minecraft:air");
  for (const entry of entries) {
    const block = getBlock(dimension, entry);
    if (block) safeRun("rollback failed repair", () => block.setPermutation(air));
  }
}

function transactionChargeEntry(entries) {
  return entries.find((entry) => entry.c !== 0) ?? entries[0];
}

function repairEntry(player, incident, selected, options = {}) {
  const heldOnly = options.heldOnly ?? true;
  const quiet = options.quiet ?? false;
  const lockKey = `${incident.id}|${selected.g ?? selected.k}`;
  if (entryLocks.has(lockKey)) return { ok: false, reason: "That echo is already being restored." };
  entryLocks.add(lockKey);
  try {
    if (selected.status === "restored" || selected.status === "dismissed") {
      return { ok: false, reason: "That echo is already resolved." };
    }
    if (player.playerPermissionLevel === PlayerPermissionLevel.Visitor) {
      return { ok: false, reason: "Visitors cannot restore build memories." };
    }
    const entries = transactionEntries(incident, selected);
    if (entries.length === 0) return { ok: false, reason: "Nothing remains to restore." };
    const charge = transactionChargeEntry(entries);
    const chargeAmount = Math.max(1, Number(charge.n ?? 1));
    const dimension = dimensionFromId(incident.dimensionId);
    const transactionKeys = new Set(entries.map((entry) => entry.k));

    if (matchingAmount(player, charge.i, heldOnly) < chargeAmount && player.getGameMode() !== GameMode.Creative) {
      return {
        ok: false,
        reason: `Hold ${chargeAmount > 1 ? `${chargeAmount} × ` : ""}${displayName(charge.i)} to restore this echo.`
      };
    }

    const permutations = [];
    for (const entry of entries.sort((a, b) => deterministicRepairOrder(a) - deterministicRepairOrder(b))) {
      const block = getBlock(dimension, entry);
      if (!block || !isAir(block.typeId)) {
        return { ok: false, reason: "Position obstructed — the newer block was not overwritten." };
      }
      if (!supportIsValid(dimension, entry, transactionKeys)) {
        return { ok: false, reason: "A required support block is missing." };
      }
      if (!isPositionSafeForEntityPlacement(dimension, entry)) {
        return { ok: false, reason: "A player or mob is inside the repair space." };
      }
      const permutation = safeRun(
        "resolve saved permutation",
        () => BlockPermutation.resolve(entry.t, entry.s)
      );
      if (!permutation) return { ok: false, reason: "The saved block state is no longer supported." };
      permutations.push({ entry, permutation });
    }

    const placed = [];
    for (const { entry, permutation } of permutations) {
      const block = getBlock(dimension, entry);
      if (!block) {
        rollbackPlaced(dimension, placed);
        return { ok: false, reason: "The repair chunk unloaded." };
      }
      try {
        block.setPermutation(permutation);
        if (!block.permutation.matches(entry.t, entry.s)) throw new Error("permutation verification failed");
        placed.push(entry);
      } catch {
        rollbackPlaced(dimension, placed);
        return { ok: false, reason: "Minecraft rejected the saved block state." };
      }
    }

    if (!consumeItems(player, charge.i, chargeAmount, heldOnly)) {
      rollbackPlaced(dimension, placed);
      return { ok: false, reason: "Inventory changed before the repair committed; no item was lost." };
    }

    for (const entry of entries) {
      entry.status = "restored";
      removeEntryRenderer(incident.id, entry.k);
    }
    store.saveIncident(incident);
    if (!quiet) {
      player.sendMessage(`§bRestored ${displayName(charge.i)}${chargeAmount > 1 ? ` × ${chargeAmount}` : ""}.`);
      safeRun("play repair sound", () => player.playSound("random.orb", { volume: 0.35, pitch: 1.25 }));
    }
    completeIncidentIfResolved(incident, player);
    return { ok: true, restored: entries.length };
  } finally {
    entryLocks.delete(lockKey);
  }
}

function completeIncidentIfResolved(incident, player) {
  const unresolved = incident.entries.some(
    (entry) => entry.status !== "restored" && entry.status !== "dismissed"
  );
  if (unresolved) return;
  incidents.delete(incident.id);
  store.removeIncident(incident.id);
  removeIncidentRenderers(incident.id);
  player.sendMessage("§bBuild restored. The echo fades.");
  safeRun("play completion sound", () => player.playSound("random.levelup", { volume: 0.35, pitch: 1.55 }));
}

function isEntryOwner(player, entry) {
  return entry.o === player.id || entry.on === player.name;
}

function canDismissEntry(player, entry) {
  return player.playerPermissionLevel === PlayerPermissionLevel.Operator || isEntryOwner(player, entry);
}

function canDismissIncident(player, incident) {
  if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
  const unresolved = incident.entries.filter(
    (entry) => entry.status !== "restored" && entry.status !== "dismissed"
  );
  return unresolved.length > 0 && unresolved.every((entry) => isEntryOwner(player, entry));
}

function dismissEntry(player, incident, entry) {
  if (entry.status === "restored" || entry.status === "dismissed") return;
  if (!canDismissEntry(player, entry)) {
    player.sendMessage("§6Only this position's placing player or an operator can dismiss it.");
    return;
  }
  entry.status = "dismissed";
  store.saveIncident(incident);
  removeEntryRenderer(incident.id, entry.k);
  player.sendMessage(`§7Dismissed ${displayName(entry.i)} at ${entry.k}.`);
  completeIncidentIfResolved(incident, player);
}

function sendFailure(player, result) {
  if (!result.ok && result.reason) player.sendMessage(`§6${result.reason}`);
}

function materialCountsForPlayer(player, incident) {
  const container = inventoryContainer(player);
  const counts = new Map();
  if (container) {
    for (let slot = 0; slot < container.size; slot += 1) {
      const stack = container.getItem(slot);
      if (!stack || !stack.isStackable) continue;
      if (!isPlainMatchingStack(stack, stack.typeId)) continue;
      counts.set(stack.typeId, (counts.get(stack.typeId) ?? 0) + stack.amount);
    }
  }
  return groupMaterials(incident.entries).map((material) => ({
    ...material,
    available: player.getGameMode() === GameMode.Creative ? "∞" : (counts.get(material.typeId) ?? 0)
  }));
}

function incidentStats(incident, player) {
  let unresolved = 0;
  let conflicts = 0;
  let unsupported = 0;
  for (const entry of incident.entries) {
    if (entry.status === "restored" || entry.status === "dismissed") continue;
    unresolved += 1;
    if (entryConflict(incident, entry)) conflicts += 1;
    if (!entry.v?.supported) unsupported += 1;
  }
  const materials = materialCountsForPlayer(player, incident);
  const available = materials.reduce(
    (sum, item) => sum + (item.available === "∞" ? item.count : Math.min(item.count, Number(item.available))),
    0
  );
  return { unresolved, conflicts, unsupported, available };
}

function openMaterials(player, incident) {
  const materials = materialCountsForPlayer(player, incident);
  const lines = materials.length === 0
    ? ["No unresolved materials."]
    : materials.map((item) => `${item.name}: ${item.count} needed · ${item.available} carried`);
  new ActionFormData()
    .title("BUILD ECHO · MATERIALS")
    .body(lines.join("\n"))
    .button("Back")
    .show(player)
    .then(() => openIncidentForm(player, incident))
    .catch((error) => logError("show materials form", error));
}

function startBatchRepair(player, incident) {
  if (batchLocks.has(incident.id)) {
    player.sendMessage("§6That incident already has a batch repair in progress.");
    return;
  }
  batchLocks.add(incident.id);
  const entries = incident.entries
    .filter((entry) => entry.status !== "restored" && entry.status !== "dismissed" && entry.v?.supported)
    .sort((a, b) => deterministicRepairOrder(a) - deterministicRepairOrder(b));

  function* batchJob() {
    let restored = 0;
    let skipped = 0;
    const handledGroups = new Set();
    try {
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (entry.g && handledGroups.has(entry.g)) continue;
        if (entry.g) handledGroups.add(entry.g);
        const result = repairEntry(player, incident, entry, { heldOnly: false, quiet: true });
        if (result.ok) restored += result.restored ?? 1;
        else skipped += 1;
        if ((index + 1) % LIMITS.batchPerTick === 0) yield;
        if (!incidents.has(incident.id)) break;
      }
      player.sendMessage(`§bBatch repair: ${restored} position${restored === 1 ? "" : "s"} restored; ${skipped} skipped.`);
    } finally {
      batchLocks.delete(incident.id);
    }
  }
  system.runJob(batchJob());
}

function accessSettings(player) {
  const current = player.getDynamicProperty("be:access");
  if (typeof current !== "string") return { hud: true, quiet: false };
  try {
    const parsed = JSON.parse(current);
    return { hud: parsed.hud !== false, quiet: parsed.quiet === true };
  } catch {
    return { hud: true, quiet: false };
  }
}

function openAccessibility(player, incident) {
  const settings = accessSettings(player);
  new ActionFormData()
    .title("BUILD ECHO · ACCESSIBILITY")
    .body("Holograms are static by design: no flashing and no precision timing.")
    .button(`Target text: ${settings.hud ? "On" : "Off"}`)
    .button(`Quiet feedback: ${settings.quiet ? "On" : "Off"}`)
    .button("Back")
    .show(player)
    .then((response) => {
      if (response.canceled) return;
      if (response.selection === 0) settings.hud = !settings.hud;
      if (response.selection === 1) settings.quiet = !settings.quiet;
      player.setDynamicProperty("be:access", JSON.stringify(settings));
      if (response.selection === 2) openIncidentForm(player, incident);
      else openAccessibility(player, incident);
    })
    .catch((error) => logError("show accessibility form", error));
}

function confirmDismissIncident(player, incident) {
  if (!canDismissIncident(player, incident)) {
    player.sendMessage("§6Collaborative memories require every unresolved position to be yours, or an operator.");
    return;
  }
  new MessageFormData()
    .title("Dismiss this memory?")
    .body("This removes the repair memory permanently. It will not alter any blocks or items.")
    .button1("Keep memory")
    .button2("Dismiss memory")
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection !== 1) return;
      incidents.delete(incident.id);
      store.removeIncident(incident.id);
      removeIncidentRenderers(incident.id);
      player.sendMessage("§7Echo memory dismissed.");
    })
    .catch((error) => logError("show dismiss confirmation", error));
}

function openIncidentForm(player, incident) {
  if (!incidents.has(incident.id)) return;
  const stats = incidentStats(incident, player);
  const omitted = incident.omitted ? `\n${incident.omitted} over-cap position(s) were not recorded.` : "";
  new ActionFormData()
    .title("BUILD ECHO")
    .body(
      `${stats.unresolved} blocks remembered\n` +
      `${stats.available} material matches carried\n` +
      `${stats.conflicts} positions obstructed\n` +
      `${stats.unsupported} outline-only visuals${omitted}`
    )
    .button("Restore available blocks")
    .button("View missing materials")
    .button(incident.visible ? "Hide holograms" : "Show holograms")
    .button("Accessibility")
    .button("Dismiss memory")
    .show(player)
    .then((response) => {
      if (response.canceled) return;
      if (response.selection === 0) startBatchRepair(player, incident);
      if (response.selection === 1) openMaterials(player, incident);
      if (response.selection === 2) {
        incident.visible = !incident.visible;
        store.saveIncident(incident);
        reconcileRenderers();
        player.sendMessage(incident.visible ? "§bHolograms shown." : "§7Holograms hidden; the Echo Core remains.");
      }
      if (response.selection === 3) openAccessibility(player, incident);
      if (response.selection === 4) confirmDismissIncident(player, incident);
    })
    .catch((error) => logError("show incident form", error));
}

function openEntryForm(player, incident, entry) {
  const required = Math.max(1, Number(entry.n ?? 1));
  const requirement = `${required > 1 ? `${required} × ` : ""}${displayName(entry.i)}`;
  new ActionFormData()
    .title(displayName(entry.i))
    .body(entryConflict(incident, entry)
      ? "CONFLICT · This position is occupied and will not be overwritten."
      : `Hold ${requirement} to restore this position.`)
    .button("Restore")
    .button("Dismiss this position")
    .button("Incident summary")
    .show(player)
    .then((response) => {
      if (response.canceled) return;
      if (response.selection === 0) {
        sendFailure(player, repairEntry(player, incident, entry, { quiet: accessSettings(player).quiet }));
      }
      if (response.selection === 1) dismissEntry(player, incident, entry);
      if (response.selection === 2) openIncidentForm(player, incident);
    })
    .catch((error) => logError("show entry form", error));
}

function handleEntityInteraction(event) {
  const lastTick = interactionTicks.get(event.player.id) ?? -100;
  if (system.currentTick - lastTick < 4) return;
  interactionTicks.set(event.player.id, system.currentTick);

  if (event.target.typeId === "buildecho:core") {
    const incidentId = coreLookup.get(event.target.id);
    const incident = incidentId ? incidents.get(incidentId) : undefined;
    if (incident) system.run(() => openIncidentForm(event.player, incident));
    return;
  }

  if (event.target.typeId !== "buildecho:echo") return;
  const lookup = echoLookup.get(event.target.id);
  const incident = lookup ? incidents.get(lookup.incidentId) : undefined;
  const entry = incident?.entries.find((value) => value.k === lookup?.entryKey);
  if (!incident || !entry) return;
  system.run(() => {
    if (event.player.isSneaking) openEntryForm(event.player, incident, entry);
    else {
      sendFailure(
        event.player,
        repairEntry(event.player, incident, entry, { quiet: accessSettings(event.player).quiet })
      );
    }
  });
}

function updateTargetHud() {
  for (const player of world.getAllPlayers()) {
    const settings = accessSettings(player);
    if (!settings.hud) continue;
    const hit = player.getEntitiesFromViewDirection({ maxDistance: LIMITS.targetDistance })
      .find((value) => value.entity.typeId === "buildecho:echo" || value.entity.typeId === "buildecho:core");
    if (!hit) continue;
    if (hit.entity.typeId === "buildecho:core") {
      player.onScreenDisplay.setActionBar("§bEcho Core §7— interact to inspect this memory");
      continue;
    }
    const lookup = echoLookup.get(hit.entity.id);
    const incident = lookup ? incidents.get(lookup.incidentId) : undefined;
    const entry = incident?.entries.find((value) => value.k === lookup?.entryKey);
    if (!incident || !entry) continue;
    if (entryConflict(incident, entry)) {
      player.onScreenDisplay.setActionBar(`§cCONFLICT · ${displayName(entry.i)} §7— position occupied`);
    } else {
      const required = Math.max(1, Number(entry.n ?? 1));
      const requirement = `${required > 1 ? `${required} × ` : ""}${displayName(entry.i)}`;
      player.onScreenDisplay.setActionBar(
        `§b${displayName(entry.i)} §7— hold ${requirement} and interact to restore`
      );
    }
  }
}

function invalidatePistonMemories(event) {
  const dimension = event.dimension;
  const affected = new Map();
  const pistonBlock = event.block;
  const facingValue = pistonBlock.permutation.getState("facing_direction");
  const facing = typeof facingValue === "number"
    ? ({ 2: "north", 3: "south", 4: "west", 5: "east" }[facingValue] ?? "south")
    : "south";
  safeRun("read piston attachments", () => {
    for (const location of event.piston.getAttachedBlocksLocations()) {
      affected.set(locationKey(location), copyLocation(location));
      affected.set(locationKey(offset(location, facing)), offset(location, facing));
      affected.set(locationKey(offset(location, opposite(facing))), offset(location, opposite(facing)));
    }
  });
  for (let distance = 1; distance <= 13; distance += 1) {
    const location = offset(pistonBlock.location, facing, distance);
    affected.set(locationKey(location), location);
  }
  for (const location of affected.values()) {
    if (memoryFor(dimension.id, location)) removeLinkedMemory(dimension.id, location);
  }
}

function subscribeEvents() {
  world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const dimension = event.player.dimension;
    const location = copyLocation(event.block.location);
    const player = event.player;
    system.runTimeout(() => safeRun("record player placement", () => recordPlacement(dimension, location, player)), 1);
  });

  world.afterEvents.playerBreakBlock.subscribe((event) => {
    safeRun("remove intentionally broken memory", () => removeLinkedMemory(event.dimension.id, event.block.location));
  });

  world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    if (!event.isFirstEvent) return;
    const dimension = event.player.dimension;
    const location = copyLocation(event.block.location);
    const player = event.player;
    system.runTimeout(
      () => safeRun("refresh interacted block state", () => refreshRememberedState(dimension, location, player)),
      1
    );
  });

  world.beforeEvents.explosion.subscribe((event) => {
    safeRun("capture explosion", () => collectExplosionSnapshot(event));
  });

  world.afterEvents.explosion.subscribe((event) => {
    safeRun("match explosion", () => matchExplosion(event));
  });

  world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    safeRun("handle echo interaction", () => handleEntityInteraction(event));
  });

  world.afterEvents.pistonActivate.subscribe((event) => {
    safeRun("invalidate piston memories", () => invalidatePistonMemories(event));
  });
}

function initialize() {
  store.initialize();
  cleanupAllRenderers();
  for (const loadedIncident of store.loadIncidents()) {
    const incident = normalizeIncident(loadedIncident);
    if (incident.entries.length === 0) {
      store.removeIncident(incident.id);
      continue;
    }
    if (!store.saveIncident(incident)) {
      console.warn(`[Build Echo] Could not persist migrated incident ${incident.id}; using it for this session.`);
    }
    incidents.set(incident.id, incident);
  }
  ready = true;
  reconcileRenderers();
  console.warn(`[Build Echo] Ready with ${incidents.size} active incident(s); storage ${store.storageBytes()} bytes.`);
}

subscribeEvents();
system.run(() => safeRun("initialize", initialize));
system.runInterval(() => safeRun("renderer reconciliation", reconcileRenderers), 20);
system.runInterval(() => safeRun("target HUD", updateTargetHud), 5);
system.runInterval(prunePendingExplosions, 20);
