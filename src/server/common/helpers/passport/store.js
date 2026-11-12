import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * In-memory store seeded from the example JSON files.
 *
 * This stands in for the passport back end. Everything a person changes in
 * the front end lives here until the service restarts, which is what we want
 * for a demo with example data. The shapes match what a Node and MongoDB
 * back end will return, so the route handlers can swap to it later.
 */

const dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(dirname, '../../../data')

function readJson(fileName) {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), 'utf-8'))
}

const catalogue = readJson('route-catalogue.json')
const pack = readJson('service-design-pack.json')
const seed = readJson('services.json')

let services = structuredClone(seed.services)
const programme = seed.programme

function getCatalogue() {
  return catalogue
}

function getPackCatalogue() {
  return pack
}

function getProgramme() {
  return programme
}

function listServices() {
  return services
}

function getService(serviceId) {
  return services.find((service) => service.id === serviceId) ?? null
}

/**
 * Adds or replaces a service.
 * @param {object} service
 */
function saveService(service) {
  const index = services.findIndex((item) => item.id === service.id)
  if (index === -1) {
    services.push(service)
  } else {
    services[index] = service
  }
  return service
}

/**
 * Records what a gate owner decided for one step, or one pack item.
 * @param {string} serviceId
 * @param {object} stamp
 * @param {'step'|'pack'} stamp.kind
 * @param {string} stamp.id step id or pack item id
 * @param {string} [stamp.journey] journey id, for journey-scoped steps
 * @param {string} stamp.status
 * @param {string} [stamp.conditions]
 * @param {string} [stamp.date] ISO date
 */
function saveStamp(serviceId, stamp) {
  const service = getService(serviceId)
  if (!service) {
    return null
  }

  const list = stamp.kind === 'pack' ? service.pack : service.stamps
  const key = stamp.kind === 'pack' ? 'item' : 'step'
  const matches = (entry) =>
    entry[key] === stamp.id &&
    (entry.journey ?? null) === (stamp.journey ?? null)

  const existing = list.find(matches)
  const next = {
    ...(existing ?? {}),
    [key]: stamp.id,
    status: stamp.status,
    date: stamp.date ?? new Date().toISOString().slice(0, 10)
  }
  if (stamp.journey) {
    next.journey = stamp.journey
  }
  if (stamp.status === 'approved-with-conditions') {
    next.conditions = stamp.conditions ?? ''
  } else {
    delete next.conditions
  }

  if (existing) {
    list[list.indexOf(existing)] = next
  } else {
    list.push(next)
  }
  return next
}

/** Puts the example data back. Used by tests. */
function resetStore() {
  services = structuredClone(seed.services)
}

export {
  getCatalogue,
  getPackCatalogue,
  getProgramme,
  getService,
  listServices,
  resetStore,
  saveService,
  saveStamp
}
