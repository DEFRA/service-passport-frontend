import { programmeController } from './controller.js'

/**
 * The programme view: every service and journey, where it is, and what is
 * at risk against its go-live date. The front page of the service.
 */
const programme = {
  plugin: {
    name: 'programme',
    register(server) {
      server.route([{ method: 'GET', path: '/', ...programmeController }])
    }
  }
}

export { programme }
