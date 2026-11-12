import Boom from '@hapi/boom'

import { buildRoute } from '#/server/common/helpers/passport/route-builder.js'
import { requireService, servicePageContext } from './service-page.js'

/**
 * One step on the route: what it is, who owns it, how long it takes, and
 * what the gate owner has decided so far.
 */
const stepController = {
  handler(request, h) {
    const service = requireService(request)
    const route = buildRoute(service)
    const journeyId = request.query.journey ?? null
    const step = route.steps.find(
      (entry) =>
        entry.id === request.params.stepId &&
        (entry.journey?.id ?? null) === journeyId
    )
    if (!step) {
      throw Boom.notFound()
    }
    const phase = route.phases.find((entry) => entry.id === step.phase)
    const updateHref = journeyId
      ? `/services/${service.id}/update/step/${step.id}?journey=${journeyId}`
      : `/services/${service.id}/update/step/${step.id}`

    return h.view('services/step', {
      pageTitle: step.name,
      ...servicePageContext(service, [
        { text: 'Route', href: `/services/${service.id}/route` },
        { text: step.name }
      ]),
      step,
      phase,
      daysLeft: route.daysLeft,
      updateHref,
      updated: request.query.updated === 'true'
    })
  }
}

export { stepController }
