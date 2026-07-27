import { world } from "@minecraft/server";
import {
  LIMITS,
  SCHEMA_VERSION,
  memoryAddress,
  safeJsonParse
} from "./model.js";

const INCIDENT_INDEX = "be:incidents";
const SCHEMA_KEY = "be:schema";

export class BuildEchoStore {
  constructor() {
    this.memoryCache = new Map();
  }

  initialize() {
    const stored = world.getDynamicProperty(SCHEMA_KEY);
    if (stored === undefined) {
      world.setDynamicProperty(SCHEMA_KEY, SCHEMA_VERSION);
      world.setDynamicProperty(INCIDENT_INDEX, "[]");
      return;
    }
    if (stored !== SCHEMA_VERSION) {
      throw new Error(`[Build Echo] Unsupported storage schema ${String(stored)}; expected ${SCHEMA_VERSION}.`);
    }
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
      if (!incident || incident.v !== SCHEMA_VERSION || !Array.isArray(incident.entries)) continue;
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
    if (!ids.includes(incident.id)) {
      if (ids.length >= LIMITS.incidents) return false;
      ids.push(incident.id);
      world.setDynamicProperty(INCIDENT_INDEX, JSON.stringify(ids));
    }
    world.setDynamicProperty(this.#incidentKey(incident.id), serialized);
    return true;
  }

  removeIncident(id) {
    let ids = safeJsonParse(world.getDynamicProperty(INCIDENT_INDEX), []);
    if (!Array.isArray(ids)) ids = [];
    world.setDynamicProperty(INCIDENT_INDEX, JSON.stringify(ids.filter((value) => value !== id)));
    world.setDynamicProperty(this.#incidentKey(id), undefined);
  }

  storageBytes() {
    return world.getDynamicPropertyTotalByteCount();
  }

  #getShard(property) {
    if (this.memoryCache.has(property)) return this.memoryCache.get(property);
    const shard = safeJsonParse(world.getDynamicProperty(property), {});
    const valid = shard && typeof shard === "object" && !Array.isArray(shard) ? shard : {};
    this.memoryCache.set(property, valid);
    return valid;
  }

  #saveShard(property, shard) {
    const keys = Object.keys(shard);
    if (keys.length === 0) {
      world.setDynamicProperty(property, undefined);
      this.memoryCache.delete(property);
      return;
    }
    const serialized = JSON.stringify(shard);
    if (serialized.length > LIMITS.propertyChars) {
      throw new Error(`[Build Echo] Memory shard ${property} exceeded the storage guard.`);
    }
    world.setDynamicProperty(property, serialized);
    this.memoryCache.set(property, shard);
  }

  #incidentKey(id) {
    return `be:i:${id}`;
  }
}
