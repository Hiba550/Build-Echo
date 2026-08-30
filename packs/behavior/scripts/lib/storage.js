import { world } from "@minecraft/server";
import {
  LIMITS,
  SCHEMA_VERSION,
  memoryAddress,
  safeJsonParse
} from "./model.js";

const INCIDENT_INDEX = "be:incidents";
const SCHEMA_KEY = "be:schema";
const MEMORY_INDEX = "be:memory_shards";
const MEMORY_PREFIX = "be:m:";

export class BuildEchoStore {
  constructor() {
    this.memoryCache = new Map();
    this.memoryShards = [];
  }

  initialize() {
    const stored = world.getDynamicProperty(SCHEMA_KEY);
    if (stored === undefined) {
      world.setDynamicProperty(SCHEMA_KEY, SCHEMA_VERSION);
      world.setDynamicProperty(INCIDENT_INDEX, "[]");
    } else if (stored !== 1 && stored !== SCHEMA_VERSION) {
      throw new Error(`[Build Echo] Unsupported storage schema ${String(stored)}; expected 1 or ${SCHEMA_VERSION}.`);
    }

    const indexed = safeJsonParse(world.getDynamicProperty(MEMORY_INDEX), []);
    const discovered = world.getDynamicPropertyIds()
      .filter((property) => property.startsWith(MEMORY_PREFIX));
    this.memoryShards = [...new Set([
      ...(Array.isArray(indexed) ? indexed.filter((value) => typeof value === "string") : []),
      ...discovered
    ])].slice(-LIMITS.memoryShards);

    for (const property of discovered) {
      if (!this.memoryShards.includes(property)) world.setDynamicProperty(property, undefined);
    }
    this.#saveMemoryIndex();
    if (stored === 1) world.setDynamicProperty(SCHEMA_KEY, SCHEMA_VERSION);
  }

  getMemory(dimensionId, location) {
    const address = memoryAddress(dimensionId, location);
    const shard = this.#getShard(address.property);
    return shard[address.entry];
  }

  setMemory(dimensionId, location, record) {
    const address = memoryAddress(dimensionId, location);
    const shard = this.#getShard(address.property);
    shard[address.entry] = record;
    this.#saveShard(address.property, shard);
  }

  removeMemory(dimensionId, location) {
    const address = memoryAddress(dimensionId, location);
    const shard = this.#getShard(address.property);
    const existing = shard[address.entry];
    if (existing === undefined) return undefined;
    delete shard[address.entry];
    this.#saveShard(address.property, shard);
    return existing;
  }

  loadIncidents() {
    const ids = safeJsonParse(world.getDynamicProperty(INCIDENT_INDEX), []);
    if (!Array.isArray(ids)) return [];
    const incidents = [];
    const validIds = [];
    for (const id of ids.slice(0, LIMITS.incidents)) {
      if (typeof id !== "string") continue;
      const incident = safeJsonParse(world.getDynamicProperty(this.#incidentKey(id)), undefined);
      if (!incident || ![1, SCHEMA_VERSION].includes(incident.v) || !Array.isArray(incident.entries)) continue;
      incidents.push(incident);
      validIds.push(id);
    }
    if (validIds.length !== ids.length) {
      world.setDynamicProperty(INCIDENT_INDEX, JSON.stringify(validIds));
    }
    return incidents;
  }

  saveIncident(incident) {
    const serialized = JSON.stringify(incident);
    if (serialized.length > LIMITS.propertyChars) return false;
    let ids = safeJsonParse(world.getDynamicProperty(INCIDENT_INDEX), []);
    if (!Array.isArray(ids)) ids = [];
    const isNew = !ids.includes(incident.id);
    if (isNew && ids.length >= LIMITS.incidents) return false;
    try {
      world.setDynamicProperty(this.#incidentKey(incident.id), serialized);
      if (isNew) {
        ids.push(incident.id);
        world.setDynamicProperty(INCIDENT_INDEX, JSON.stringify(ids));
      }
      return true;
    } catch {
      if (isNew) {
        try {
          world.setDynamicProperty(this.#incidentKey(incident.id), undefined);
        } catch {
          // The outer caller reports the failed save; cleanup is best-effort.
        }
      }
      return false;
    }
  }

  removeIncident(id) {
    let ids = safeJsonParse(world.getDynamicProperty(INCIDENT_INDEX), []);
    if (!Array.isArray(ids)) ids = [];
    try {
      world.setDynamicProperty(INCIDENT_INDEX, JSON.stringify(ids.filter((value) => value !== id)));
      world.setDynamicProperty(this.#incidentKey(id), undefined);
      return true;
    } catch {
      return false;
    }
  }

  storageBytes() {
    return world.getDynamicPropertyTotalByteCount();
  }

  #getShard(property) {
    if (this.memoryCache.has(property)) {
      const cached = this.memoryCache.get(property);
      this.memoryCache.delete(property);
      this.memoryCache.set(property, cached);
      return cached;
    }
    const shard = safeJsonParse(world.getDynamicProperty(property), {});
    const valid = shard && typeof shard === "object" && !Array.isArray(shard) ? shard : {};
    this.memoryCache.set(property, valid);
    this.#trimCache();
    return valid;
  }

  #saveShard(property, shard) {
    const keys = Object.keys(shard);
    if (keys.length === 0) {
      world.setDynamicProperty(property, undefined);
      this.memoryCache.delete(property);
      const index = this.memoryShards.indexOf(property);
      if (index >= 0) {
        this.memoryShards.splice(index, 1);
        this.#saveMemoryIndex();
      }
      return;
    }
    const serialized = JSON.stringify(shard);
    if (serialized.length > LIMITS.propertyChars) {
      throw new Error(`[Build Echo] Memory shard ${property} exceeded the storage guard.`);
    }
    if (!this.memoryShards.includes(property)) {
      while (this.memoryShards.length >= LIMITS.memoryShards) {
        const evicted = this.memoryShards.shift();
        if (!evicted) break;
        world.setDynamicProperty(evicted, undefined);
        this.memoryCache.delete(evicted);
        console.warn(`[Build Echo] Placement-memory budget reached; retired oldest shard ${evicted}.`);
      }
      this.memoryShards.push(property);
      this.#saveMemoryIndex();
    }
    world.setDynamicProperty(property, serialized);
    this.memoryCache.delete(property);
    this.memoryCache.set(property, shard);
    this.#trimCache();
  }

  #trimCache() {
    while (this.memoryCache.size > LIMITS.memoryCacheShards) {
      const oldest = this.memoryCache.keys().next().value;
      if (oldest === undefined) break;
      this.memoryCache.delete(oldest);
    }
  }

  #saveMemoryIndex() {
    world.setDynamicProperty(MEMORY_INDEX, JSON.stringify(this.memoryShards));
  }

  #incidentKey(id) {
    return `be:i:${id}`;
  }
}
