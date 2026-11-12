import { config } from '#/config/config.js'
import { sessionKey } from '#/server/routes/sign-in/controller.js'

const openPaths = ['/sign-in', '/health', '/cookies']
const openPrefixes = ['/public/']

function isOpen(path) {
  return (
    openPaths.includes(path) ||
    openPrefixes.some((prefix) => path.startsWith(prefix))
  )
}

/**
 * Sends anyone without a signed-in session to the password page. Does
 * nothing when no password is configured.
 */
const passwordGate = {
  plugin: {
    name: 'password-gate',
    register(server) {
      if (!config.get('passport.password')) {
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
