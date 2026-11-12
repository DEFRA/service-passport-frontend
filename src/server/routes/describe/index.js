import {
  checkAnswersController,
  questionController,
  questionSubmitController,
  saveController,
  startController
} from './controller.js'

/**
 * Describe your service: the question pages that tailor a route, then
 * check answers. Works for a new service (/describe) and for one that
 * already has a passport (/services/{serviceId}/describe).
 */
const describe = {
  plugin: {
    name: 'describe',
    register(server) {
      for (const prefix of ['/describe', '/services/{serviceId}/describe']) {
        server.route([
          { method: 'GET', path: prefix, ...startController },
          {
            method: 'GET',
            path: `${prefix}/check-answers`,
            ...checkAnswersController
          },
          {
            method: 'POST',
            path: `${prefix}/check-answers`,
            ...saveController
          },
          {
            method: 'GET',
            path: `${prefix}/{questionId}`,
            ...questionController
          },
          {
            method: 'POST',
            path: `${prefix}/{questionId}`,
            ...questionSubmitController
          }
        ])
      }
    }
  }
}

export { describe }
