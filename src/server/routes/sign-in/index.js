import { signInController, signInSubmitController } from './controller.js'

/**
 * A single shared password on the whole front end, for the alpha. Only
 * active when PASSPORT_PASSWORD is set, so local development needs nothing.
 * Defra sign-in through CDP replaces this.
 */
const signIn = {
  plugin: {
    name: 'sign-in',
    register(server) {
      server.route([
        { method: 'GET', path: '/sign-in', ...signInController },
        { method: 'POST', path: '/sign-in', ...signInSubmitController }
      ])
    }
  }
}

export { signIn }
