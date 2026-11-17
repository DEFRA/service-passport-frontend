import { config } from '#/config/config.js'
import { sessionKey } from '#/server/routes/sign-in/controller.js'

const openPaths = ['/sign-in', '/health', '/cookies', '/favicon.ico']
const openPrefixes = ['/public/']

function isOpen(path) {
  return (
    openPaths.includes(path) ||
    openPrefixes.some((prefix) => path.startsWith(prefix))
  )
}

/**
 * Sends anyone without a signed-in session to the password page. Locally,
 * no password turns the gate off. In production, no password stops the
 * server starting, so a missing secret never leaves the prototype public.
 * @throws {Error} when the password is empty in production
 */
const passwordGate = {
  plugin: {
    name: 'password-gate',
    register(server) {
      if (!config.get('passport.password')) {
        if (config.get('isProduction')) {
          throw new Error('PASSPORT_PASSWORD must be set in production')
        }
        return
      }
      server.ext('onPreHandler', (request, h) => {
        if (isOpen(request.path) || request.yar.get(sessionKey)) {
          return h.continue
        }
        const returnUrl = encodeURIComponent(request.url.pathname)
        return h.redirect(`/sign-in?returnUrl=${returnUrl}`).takeover()
      })
    }
  }
}

export { isOpen, passwordGate }
