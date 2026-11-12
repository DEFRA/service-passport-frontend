import { packController, packItemController } from './pack-controller.js'
import { passportController } from './passport-controller.js'
import { routeController } from './route-controller.js'
import { stepController } from './step-controller.js'
import {
  updateStampController,
  updateStampSubmitController
} from './update-stamp-controller.js'

/**
 * Everything about one service: its passport, route, Service Design Pack,
 * steps and stamps. These routes are registered in src/server/plugins/router.js.
 */
const services = {
  plugin: {
    name: 'services',
    register(server) {
      server.route([
        { method: 'GET', path: '/services/{serviceId}', ...passportController },
        {
          method: 'GET',
          path: '/services/{serviceId}/route',
          ...routeController
        },
        {
          method: 'GET',
          path: '/services/{serviceId}/service-design-pack',
          ...packController
        },
        {
          method: 'GET',
          path: '/services/{serviceId}/service-design-pack/{itemId}',
          ...packItemController
        },
        {
          method: 'GET',
          path: '/services/{serviceId}/steps/{stepId}',
          ...stepController
        },
        {
          method: 'GET',
          path: '/services/{serviceId}/update/{kind}/{id}',
          ...updateStampController
        },
        {
          method: 'POST',
          path: '/services/{serviceId}/update/{kind}/{id}',
          ...updateStampSubmitController
        }
      ])
    }
  }
}

export { services }
