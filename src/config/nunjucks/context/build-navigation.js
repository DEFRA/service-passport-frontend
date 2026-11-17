const items = [
  { text: 'Passport', href: '/passport' },
  { text: 'Plan', href: '/plan' },
  { text: 'About your service', href: '/about-your-service/check' }
]

/**
 * Whether this visitor has confirmed a route. A page that fails before the
 * session loads, such as a 404, has no session to read, so it counts as no.
 * @param {object} [request]
 * @returns {boolean}
 */
export function hasRoute(request) {
  try {
    return Boolean(request?.yar?.get('passport')?.confirmed)
  } catch {
    return false
  }
}

/**
 * The service navigation, on every page so people can see the whole service
 * from the start. Before set-up, Passport and Plan explain what is missing.
 * A page counts as current when it sits under that item's address, so a
 * step page highlights Passport.
 * @param {object} [request]
 * @returns {Array<{text: string, href: string, current: boolean}>}
 */
export function buildNavigation(request) {
  const section = (request.path ?? '').split('/')[1]
  return items.map((item) => ({
    ...item,
    current: item.href.split('/')[1] === section
  }))
}
