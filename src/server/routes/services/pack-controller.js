import Boom from '@hapi/boom'

import { buildPack } from '#/server/common/helpers/passport/route-builder.js'
import { requireService, servicePageContext } from './service-page.js'

/**
 * The Service Design Pack slice: its items by group, each with a status,
 * an owner and a link to where the evidence lives.
 */
const packController = {
  handler(request, h) {
    const service = requireService(request)
    const pack = buildPack(service)
    return h.view('services/pack', {
      pageTitle: `Service Design Pack for ${service.name}`,
      ...servicePageContext(service, [{ text: 'Service Design Pack' }]),
      pack
    })
  }
}

const packItemController = {
  handler(request, h) {
    const service = requireService(request)
    const pack = buildPack(service)
    const item = pack.items.find((entry) => entry.id === request.params.itemId)
    if (!item) {
      throw Boom.notFound()
    }
    return h.view('services/pack-item', {
      pageTitle: item.name,
      ...servicePageContext(service, [
        {
          text: 'Service Design Pack',
          href: `/services/${service.id}/service-design-pack`
        },
        { text: item.name }
      ]),
      item,
      updateHref: `/services/${service.id}/update/pack/${item.id}`,
      updated: request.query.updated === 'true'
    })
  }
}

export { packController, packItemController }
