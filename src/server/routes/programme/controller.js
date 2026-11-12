import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import {
  buildRoute,
  lastGatePassed,
  programmeStatus
} from '#/server/common/helpers/passport/route-builder.js'
import {
  getCatalogue,
  getProgramme,
  listServices
} from '#/server/common/helpers/passport/store.js'

const dateFormat = 'd MMMM yyyy'

function phaseLabel(phaseId, tailoring) {
  const phase = getCatalogue().phases.find((item) => item.id === phaseId)
  if (!phase) {
    return ''
  }
  return tailoring?.approach === 'waterfall' ? phase.waterfall : phase.agile
}

/**
 * One row per service, with a row under it for each journey.
 * @param {object} service
 */
function toRows(service) {
  const route = buildRoute(service)
  const status = programmeStatus(route)
  const serviceRow = {
    id: service.id,
    name: service.name,
    href: `/services/${service.id}`,
    phase: phaseLabel(service.phase, service.tailoring),
    gate: lastGatePassed(route),
    goLive: service.goLive ? formatDate(service.goLive, dateFormat) : '',
    status,
    next: route.next?.name ?? '',
    isJourney: false
  }
  const journeyRows = (service.journeys ?? []).map((journey) => {
    const journeySteps = route.remaining.filter(
      (step) => step.journey?.id === journey.id
    )
    const journeyAtRisk = journeySteps.some((step) => step.atRisk)
    return {
      id: journey.id,
      name: journey.name,
      href: `/services/${service.id}`,
      phase: phaseLabel(journey.phase, service.tailoring),
      gate: journey.supplier,
      goLive: '',
      status: journeyAtRisk
        ? { text: 'At risk', classes: 'govuk-tag--red' }
        : { text: 'On track', classes: 'govuk-tag--green' },
      next: journeySteps.find((step) => step.needsBooking)?.name ?? '',
      isJourney: true
    }
  })
  return [serviceRow, ...journeyRows]
}

const programmeController = {
  handler(_request, h) {
    const rows = listServices().flatMap(toRows)
    const services = rows.filter((row) => !row.isJourney)
    return h.view('programme/index', {
      pageTitle: 'Programme view',
      programme: getProgramme(),
      rows,
      counts: {
        services: services.length,
        atRisk: services.filter((row) => row.status.text === 'At risk').length
      }
    })
  }
}

export { programmeController }
