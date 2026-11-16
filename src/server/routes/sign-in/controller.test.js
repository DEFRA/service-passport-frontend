import { statusCodes } from '#/server/common/constants/status-codes.js'

async function serverWithPassword(password) {
  vi.resetModules()
  vi.stubEnv('PASSPORT_PASSWORD', password)
  const { createServer } = await import('#/server/server.js')
  const server = await createServer()
  await server.initialize()
  return server
}

async function signIn(server, password) {
  const page = await server.inject({
    method: 'GET',
    url: '/sign-in?returnUrl=%2Fabout-your-service'
  })
  const cookies = page.headers['set-cookie']
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
  const crumb = page.payload.match(/name="crumb" value="([^"]+)"/)[1]
  const response = await server.inject({
    method: 'POST',
    url: '/sign-in',
    headers: { cookie: cookies },
    payload: { crumb, password, returnUrl: '/about-your-service' }
  })
  return { response, cookies }
}

describe('password gate', () => {
  let server

  afterEach(async () => {
    vi.unstubAllEnvs()
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
      expect(right.response.headers.location).toBe(
        '/about-your-service'
      )

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
