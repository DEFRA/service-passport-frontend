import { timingSafeEqual } from 'node:crypto'

import { config } from '#/config/config.js'
import { isSafeRedirect } from '#/server/common/helpers/is-safe-redirect.js'

const sessionKey = 'signedIn'
const wrongPassword = 'The password is not correct'

function matches(given, expected) {
  const a = Buffer.from(String(given ?? ''))
  const b = Buffer.from(String(expected ?? ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

function view(h, { error, returnUrl }) {
  return h.view('sign-in/index', {
    pageTitle: 'This is a prototype used for research',
    error,
    returnUrl
  })
}

const signInController = {
  handler(request, h) {
    return view(h, { returnUrl: request.query.returnUrl ?? '/' })
  }
}

const signInSubmitController = {
  handler(request, h) {
    const { password, returnUrl } = request.payload ?? {}
    if (!matches(password, config.get('passport.password'))) {
      return view(h, { error: wrongPassword, returnUrl }).code(400)
    }
    request.yar.set(sessionKey, true)
    return h.redirect(isSafeRedirect(returnUrl) ? returnUrl : '/')
  }
}

export { sessionKey, signInController, signInSubmitController }
