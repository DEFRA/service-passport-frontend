import { buildRoute } from '#/server/common/helpers/passport/route-builder.js'
import { requireService, servicePageContext } from './service-page.js'

/**
 * The whole route for one service: every phase, gate and step, with its
 * owner and typical wait, whether done or not.
 */
const routeController = {
  handler(request, h) {
    const service = requireService(request)
    const route = buildRoute(service)
    return h.view('services/route', {
      pageTitle: `Route for ${service.name}`,
      ...servicePageContext(service, [{ text: 'Route' }]),
      route
    })
  }
}

export { routeController }
