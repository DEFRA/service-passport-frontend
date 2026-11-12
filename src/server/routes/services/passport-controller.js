import {
  buildPack,
  buildRoute,
  lastGatePassed
} from '#/server/common/helpers/passport/route-builder.js'
import { requireService, servicePageContext } from './service-page.js'

/**
 * The passport: the hub for one service. Shows what to book now, what is
 * left before go-live, and the stamps so far.
 */
const passportController = {
  handler(request, h) {
    const service = requireService(request)
    const route = buildRoute(service)
    const pack = buildPack(service)
    const remainingPhases = route.phases
      .map((phase) => ({
        ...phase,
        steps: phase.steps.filter((step) => !step.done)
      }))
      .filter((phase) => phase.steps.length > 0)

    return h.view('services/passport', {
      pageTitle: service.name,
      ...servicePageContext(service),
      route,
      pack,
      remainingPhases,
      gateText: lastGatePassed(route),
      updated: request.query.updated === 'true'
    })
  }
}

export { passportController }
