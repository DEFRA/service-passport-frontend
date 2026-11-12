import * as cheerio from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  getService,
  resetStore
} from '#/server/common/helpers/passport/store.js'
import { readAnswer } from './controller.js'
import { questions } from './questions.js'

const byId = Object.fromEntries(
  questions.map((question) => [question.id, question])
)

describe('#readAnswer', () => {
  test('needs an answer', () => {
    expect(readAnswer(byId.approach, {})).toEqual({
      error: 'Select agile or waterfall'
    })
    expect(readAnswer(byId.name, { name: '  ' })).toEqual({
      error: 'Enter the name of the service'
    })
  })

  test('rejects an option that is not offered', () => {
    expect(readAnswer(byId.size, { size: 'huge' }).error).toBe(
      'Select how big the change is'
    )
  })

  test('turns yes and no into booleans', () => {
    expect(readAnswer(byId.ai, { usesAi: 'true' })).toEqual({ value: true })
    expect(readAnswer(byId.suppliers, { suppliers: 'false' })).toEqual({
      value: false
    })
  })

  test('reads a real date and rejects an impossible one', () => {
    expect(
      readAnswer(byId['go-live'], { day: '5', month: '4', year: '2028' })
    ).toEqual({ value: '2028-04-05' })
    expect(
      readAnswer(byId['go-live'], { day: '31', month: '2', year: '2028' }).error
    ).toBe('Go-live date must be a real date')
    expect(readAnswer(byId['go-live'], {}).error).toBe('Enter the go-live date')
  })
})

/** Follows the question pages in order, keeping the session cookie. */
class Browser {
  constructor(server) {
    this.server = server
    this.cookies = {}
  }

  header() {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }

  remember(response) {
    for (const cookie of response.headers['set-cookie'] ?? []) {
      const [pair] = cookie.split(';')
      const [name, value] = pair.split('=')
      this.cookies[name] = value
    }
  }

  async get(url) {
    const response = await this.server.inject({
      method: 'GET',
      url,
      headers: { cookie: this.header() }
    })
    this.remember(response)
    return response
  }

  async post(url, payload) {
    const page = await this.get(url)
    const crumb = page.payload.match(/name="crumb" value="([^"]+)"/)[1]
    const response = await this.server.inject({
      method: 'POST',
      url,
      headers: { cookie: this.header() },
      payload: { crumb, ...payload }
    })
    this.remember(response)
    return response
  }
}

describe('describe your service', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => resetStore())

  test('starts at the name for a new service', async () => {
    const response = await server.inject({ method: 'GET', url: '/describe' })
    expect(response.statusCode).toBe(statusCodes.redirect)
    expect(response.headers.location).toBe('/describe/name')
  })

  test('skips the name for a service that has a passport', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/services/plant-export-checks/describe'
    })
    expect(response.headers.location).toBe(
      '/services/plant-export-checks/describe/approach'
    )
    const name = await server.inject({
      method: 'GET',
      url: '/services/plant-export-checks/describe/name'
    })
    expect(name.statusCode).toBe(statusCodes.notFound)
  })

  test('shows an error summary when a question is skipped', async () => {
    const browser = new Browser(server)
    const response = await browser.post('/describe/approach', {})
    const $ = cheerio.load(response.payload)
    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary a').attr('href')).toBe('#approach')
    expect($('title').text()).toContain('Error:')
  })

  test('builds a tailored route from the answers', async () => {
    const browser = new Browser(server)
    const answers = [
      ['name', { name: 'Hedgerow survey bookings' }],
      ['approach', { approach: 'waterfall' }],
      ['suppliers', { suppliers: 'true' }],
      ['ai', { usesAi: 'true' }],
      ['platform', { platform: 'azure' }],
      ['size', { size: 'large' }],
      ['go-live', { day: '28', month: '2', year: '2028' }]
    ]
    for (const [id, payload] of answers) {
      const response = await browser.post(`/describe/${id}`, payload)
      expect(response.statusCode, id).toBe(statusCodes.redirect)
    }
    const check = await browser.get('/describe/check-answers')
    const $ = cheerio.load(check.payload)
    expect(
      $('.govuk-summary-list__value')
        .map((_, el) => $(el).text().trim())
        .get()
    ).toEqual([
      'Hedgerow survey bookings',
      'Waterfall',
      'Yes',
      'Yes',
      'Core Delivery Platform, connected to the Azure platform',
      'Large',
      '28 February 2028'
    ])

    const save = await browser.post('/describe/check-answers', {})
    expect(save.headers.location).toBe(
      '/services/hedgerow-survey-bookings?updated=true'
    )
    const service = getService('hedgerow-survey-bookings')
    expect(service.tailoring).toEqual({
      approach: 'waterfall',
      suppliers: true,
      usesAi: true,
      platform: 'azure',
      size: 'large'
    })

    const passport = await browser.get(save.headers.location)
    expect(passport.payload).toContain('Route updated')
    expect(passport.payload).toContain('Algorithmic transparency record')
    expect(passport.payload).toContain('Gate 2: delivery strategy')
    expect(passport.payload).not.toContain('service assessment')
  })

  test('sends an unfinished check answers back to the first missing question', async () => {
    const browser = new Browser(server)
    await browser.post('/describe/name', { name: 'Half done' })
    const response = await browser.get('/describe/check-answers')
    expect(response.headers.location).toBe('/describe/approach')
  })

  test('changing one answer returns to check answers', async () => {
    const browser = new Browser(server)
    const response = await browser.post(
      '/services/plant-export-checks/describe/size?change=true',
      { size: 'large' }
    )
    expect(response.headers.location).toBe(
      '/services/plant-export-checks/describe/check-answers'
    )
    const save = await browser.post(
      '/services/plant-export-checks/describe/check-answers',
      {}
    )
    expect(save.headers.location).toBe(
      '/services/plant-export-checks?updated=true'
    )
    expect(getService('plant-export-checks').tailoring.size).toBe('large')
    expect(getService('plant-export-checks').stamps.length).toBeGreaterThan(0)
  })
})
