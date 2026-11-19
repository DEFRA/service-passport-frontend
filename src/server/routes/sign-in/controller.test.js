import * as cheerio from 'cheerio'

import { config } from '#/config/config.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { createServer } from '#/server/server.js'

const configuredPassword = config.get('passport.password')

async function serverWithPassword(password) {
  config.set('passport.password', password)
  const server = await createServer()
  await server.initialize()
  return server
}

async function signIn(
  server,
  password,
  signInUrl = '/sign-in?returnUrl=%2Fabout-your-service'
) {
  const page = await server.inject({
    method: 'GET',
    url: signInUrl
  })
  const $ = cheerio.load(page.payload)
  const form = $('form[action="/sign-in"]')
  const cookies = page.headers['set-cookie']
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
  const crumb = form.find('input[name="crumb"]').val()
  const response = await server.inject({
    method: 'POST',
    url: '/sign-in',
    headers: { cookie: cookies },
    payload: {
      crumb,
      password,
      returnUrl: form.find('input[name="returnUrl"]').val()
    }
  })
  return { response, cookies }
}

describe('password gate', () => {
  let server

  afterEach(async () => {
    config.set('passport.password', configuredPassword)
    await server?.stop({ timeout: 0 })
  })

  test(
    'lets everything through when no password is set',
    { timeout: 30000 },
    async () => {
      server = await serverWithPassword('')
      const { statusCode } = await server.inject({ method: 'GET', url: '/' })
      expect(statusCode).toBe(statusCodes.ok)
    }
  )

  test(
    'preserves the dashboard view and journey through password sign-in',
    { timeout: 30000 },
    async () => {
      server = await serverWithPassword('example-only')
      const url = '/dashboard?view=delivery&journey=plants'
      const gated = await server.inject(url)
      expect(gated.statusCode).toBe(statusCodes.redirect)
      expect(gated.headers.location).toBe(
        `/sign-in?returnUrl=${encodeURIComponent(url)}`
      )

      const right = await signIn(server, 'example-only', gated.headers.location)
      expect(right.response.statusCode).toBe(statusCodes.redirect)
      expect(right.response.headers.location).toBe(url)

      const sessionCookie = right.response.headers['set-cookie']
        .map((cookie) => cookie.split(';')[0])
        .join('; ')
      const after = await server.inject({
        method: 'GET',
        url: right.response.headers.location,
        headers: { cookie: sessionCookie }
      })
      expect(after.statusCode).toBe(statusCodes.ok)
      const $ = cheerio.load(after.payload)
      expect($('#selected-journey').text()).toBe('Plants')
      expect($('nav[aria-label="View as"] a[aria-current]').text()).toBe(
        'Delivery lead'
      )
    }
  )

  test(
    'sends people to the password page and back again',
    { timeout: 30000 },
    async () => {
      server = await serverWithPassword('example-only')
      const gated = await server.inject({
        method: 'GET',
        url: '/about-your-service'
      })
      expect(gated.statusCode).toBe(statusCodes.redirect)
      expect(gated.headers.location).toBe(
        '/sign-in?returnUrl=%2Fabout-your-service'
      )

      const health = await server.inject({ method: 'GET', url: '/health' })
      expect(health.statusCode).toBe(statusCodes.ok)

      const wrong = await signIn(server, 'nope')
      expect(wrong.response.statusCode).toBe(statusCodes.badRequest)
      expect(wrong.response.payload).toContain('The password is not correct')

      const right = await signIn(server, 'example-only')
      expect(right.response.statusCode).toBe(statusCodes.redirect)
      expect(right.response.headers.location).toBe('/about-your-service')

      const sessionCookie = right.response.headers['set-cookie']
        .map((cookie) => cookie.split(';')[0])
        .join('; ')
      const after = await server.inject({
        method: 'GET',
        url: '/about-your-service',
        headers: { cookie: sessionCookie }
      })
      expect(after.statusCode).toBe(statusCodes.ok)
    }
  )
})
