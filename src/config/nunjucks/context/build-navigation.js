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
 * The service navigation, shown once a person has confirmed their route.
 * A page counts as current when it sits under that item's address, so a
 * step page highlights Passport.
 * @param {object} [request]
 * @returns {Array<{text: string, href: string, current: boolean}>}
 */
export function buildNavigation(request) {
  if (!hasRoute(request)) {
    return []
  }
  const section = (request.path ?? '').split('/')[1]
  return items.map((item) => ({
    ...item,
    current: item.href.split('/')[1] === section
  }))
}
