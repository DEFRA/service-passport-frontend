import Joi from 'joi'

import { data, showDashboard, showFullRoute } from './controllers.js'

const query = Joi.object({
  view: Joi.string().valid('senior', 'delivery').default('senior'),
  journey: Joi.string()
    .valid(...data.journeys.map((item) => item.id))
    .default(data.journeys[0].id)
})

export const dashboard = {
  plugin: {
    name: 'dashboard',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/dashboard',
          handler: showDashboard,
          options: { validate: { query } }
        },
        {
          method: 'GET',
          path: '/dashboard/route',
          handler: showFullRoute,
          options: { validate: { query } }
        }
      ])
    }
  }
}
