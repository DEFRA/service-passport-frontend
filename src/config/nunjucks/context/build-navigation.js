const items = [
  { text: 'Passport', href: '/passport', under: '/passport' },
  { text: 'Calendar', href: '/calendar', under: '/calendar' },
  {
    text: 'Service',
    href: '/about-your-service/check',
    under: '/about-your-service'
  },
  { text: 'Ask', href: '/passport/ask', under: '/passport/ask' }
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

function isUnder(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/**
 * The service navigation, on every page so people can see the whole service
 * from the start. Before set-up, Passport and Calendar explain what is missing.
 * The item whose address the page sits most closely under is current, so a
 * step page highlights Passport and the Ask page highlights Ask.
 * @param {object} [request]
 * @returns {Array<{text: string, href: string, current: boolean}>}
 */
export function buildNavigation(request) {
  const path = request.path ?? ''
  const current = items
    .filter((item) => isUnder(path, item.under))
    .sort((a, b) => b.under.length - a.under.length)[0]
  return items.map(({ text, href, under }) => ({
    text,
    href,
    current: under === current?.under
  }))
}
