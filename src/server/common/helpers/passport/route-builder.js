import { differenceInCalendarDays, parseISO } from 'date-fns'

import { getCatalogue, getPackCatalogue } from './store.js'
import { getStatus, statusTag } from './statuses.js'

const daysPerWeek = 7
const gate4Items = ['service-design', 'gate-4']

/**
 * Whether a catalogue step applies to a service, given its tailoring answers.
 * @param {object} step
 * @param {object} tailoring
 */
function stepApplies(step, tailoring) {
  if (!step.appliesWhen) {
    return true
  }
  return Object.entries(step.appliesWhen).every(
    ([key, value]) => tailoring?.[key] === value
  )
}

function phaseName(phase, tailoring) {
  return tailoring?.approach === 'waterfall' ? phase.waterfall : phase.agile
}

function findStamp(service, stepId, journeyId = null) {
  return (
    service.stamps.find(
      (stamp) => stamp.step === stepId && (stamp.journey ?? null) === journeyId
    ) ?? null
  )
}

/**
 * Builds the tailored route for a service: every phase, with the steps that
 * apply, each carrying its stamp, status tag and whether it is done.
 * @param {object} service
 * @param {Date} [today]
 */
function buildRoute(service, today = new Date()) {
  const catalogue = getCatalogue()
  const tailoring = service.tailoring ?? {}
  const journeys = service.journeys ?? []
  const daysLeft = service.goLive
    ? differenceInCalendarDays(parseISO(service.goLive), today)
    : null

  const steps = catalogue.steps
    .filter((step) => stepApplies(step, tailoring))
    .flatMap((step) => {
      const perJourney = step.scope === 'journey' && journeys.length > 0
      const instances = perJourney ? journeys : [null]
      return instances.map((journey) => {
        const stamp = findStamp(service, step.id, journey?.id ?? null)
        const status = getStatus(stamp?.status ?? 'not-started')
        const needsBooking =
          step.waitWeeks > 0 &&
          ['not-started', 'not-approved'].includes(status.id)
        const atRisk =
          needsBooking &&
          daysLeft !== null &&
          daysLeft >= 0 &&
          step.waitWeeks * daysPerWeek > daysLeft
        return {
          ...step,
          journey,
          stamp,
          status,
          tag: statusTag(status.id),
          done: status.done,
          needsBooking,
          atRisk,
          href: journey
            ? `/services/${service.id}/steps/${step.id}?journey=${journey.id}`
            : `/services/${service.id}/steps/${step.id}`
        }
      })
    })

  const phases = catalogue.phases.map((phase) => {
    const phaseSteps = steps.filter((step) => step.phase === phase.id)
    return {
      ...phase,
      name: phaseName(phase, tailoring),
      steps: phaseSteps,
      done: phaseSteps.length > 0 && phaseSteps.every((step) => step.done),
      current: phase.id === service.phase
    }
  })

  const remaining = steps.filter((step) => !step.done)
  const warnings = remaining
    .filter((step) => step.needsBooking)
    .sort((a, b) => b.waitWeeks - a.waitWeeks)
  const next = warnings.find((step) => step.atRisk) ?? warnings[0] ?? null

  return {
    phases,
    steps,
    remaining,
    warnings,
    next,
    daysLeft,
    doneCount: steps.length - remaining.length,
    totalCount: steps.length,
    atRisk: remaining.some((step) => step.atRisk),
    isLive:
      daysLeft !== null &&
      daysLeft < 0 &&
      steps.some((step) => step.id === 'gate-4' && step.done)
  }
}

/**
 * The highest gate a service has passed, as a short label.
 * @param {object} route
 */
function lastGatePassed(route) {
  const gates = route.steps.filter((step) => step.isGate && step.done)
  const last = gates.at(-1)
  return last
    ? `Gate ${last.name.replace(/^Gate (\d).*/, '$1')} passed`
    : 'Before gate 1'
}

/**
 * The programme-level status for a service.
 * @param {object} route
 */
function programmeStatus(route) {
  if (route.isLive) {
    return { text: 'Live', classes: 'govuk-tag--grey' }
  }
  if (route.atRisk) {
    return { text: 'At risk', classes: 'govuk-tag--red' }
  }
  return { text: 'On track', classes: 'govuk-tag--green' }
}

/**
 * The Service Design Pack for a service: items grouped as the pack groups
 * them, each with its status.
 * @param {object} service
 */
function buildPack(service) {
  const catalogue = getPackCatalogue()
  const entries = service.pack ?? []
  const items = catalogue.items.map((item) => {
    const entry = entries.find((e) => e.item === item.id) ?? null
    const status = getStatus(entry?.status ?? 'not-started')
    return {
      ...item,
      entry,
      status,
      tag: statusTag(status.id),
      done: status.done,
      href: `/services/${service.id}/service-design-pack/${item.id}`
    }
  })
  const groups = catalogue.groups.map((group) => ({
    ...group,
    items: items.filter((item) => item.group === group.id)
  }))
  const forGate4 = items.filter((item) => gate4Items.includes(item.group))
  return {
    groups,
    items,
    doneCount: forGate4.filter((item) => item.done).length,
    totalCount: forGate4.length
  }
}

export { buildPack, buildRoute, lastGatePassed, programmeStatus, stepApplies }
