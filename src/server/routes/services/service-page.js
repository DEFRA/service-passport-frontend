import Boom from '@hapi/boom'

import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import {
  getCatalogue,
  getService
} from '#/server/common/helpers/passport/store.js'

const dateFormat = 'd MMMM yyyy'

/**
 * Loads the service for a request, or throws a 404.
 * @param {import('@hapi/hapi').Request} request
 */
function requireService(request) {
  const service = getService(request.params.serviceId)
  if (!service) {
    throw Boom.notFound()
  }
  return service
}

/**
 * The phase name as the service's approach calls it.
 * @param {string} phaseId
 * @param {object} tailoring
 */
function phaseName(phaseId, tailoring) {
  const phase = getCatalogue().phases.find((item) => item.id === phaseId)
  if (!phase) {
    return ''
  }
  return tailoring?.approach === 'waterfall' ? phase.waterfall : phase.agile
}

/**
 * Breadcrumbs and shared context for every page inside a service.
 * @param {object} service
 * @param {Array<{text: string, href?: string}>} trail pages after the service
 */
function servicePageContext(service, trail = []) {
  return {
    service,
    goLiveText: service.goLive ? formatDate(service.goLive, dateFormat) : '',
    phaseText: phaseName(service.phase, service.tailoring),
    breadcrumbs: [
      { text: 'Programme', href: '/' },
      { text: service.name, href: `/services/${service.id}` },
      ...trail
    ]
  }
}

export { dateFormat, phaseName, requireService, servicePageContext }
