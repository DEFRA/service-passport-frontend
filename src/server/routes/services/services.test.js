import * as cheerio from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  getService,
  resetStore
} from '#/server/common/helpers/passport/store.js'

/**
 * Gets a page, then posts a form to the same server with the CSRF crumb and
 * session cookie that page set.
 */
async function postForm(server, url, payload) {
  const page = await server.inject({ method: 'GET', url })
  const cookies = (page.headers['set-cookie'] ?? [])
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
  const crumb = page.payload.match(/name="crumb" value="([^"]+)"/)[1]
  return server.inject({
    method: 'POST',
    url,
    headers: { cookie: cookies },
    payload: { crumb, ...payload }
  })
}

describe('service pages', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => resetStore())

  test('the programme view lists every service and its journeys', async () => {
    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })
    const $ = cheerio.load(payload)
    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text()).toBe('Where every service is')
    expect($('tbody tr').length).toBe(8)
    expect($('.app-programme-table__journey').length).toBe(3)
    expect($('.govuk-tag--red').text().trim()).toBe('At risk')
  })

  test('the passport shows what to book next and what is left', async () => {
    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: '/services/plant-export-checks'
    })
    const $ = cheerio.load(payload)
    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-warning-text').text()).toContain(
      'Next: accessibility audit'
    )
    expect($('main h2').first().text()).toBe('What is left before go-live')
    expect($('.govuk-task-list__item').length).toBe(10)
  })

  test('the route shows every phase with the current one marked', async () => {
    const { payload } = await server.inject({
      method: 'GET',
      url: '/services/plant-export-checks/route'
    })
    const $ = cheerio.load(payload)
    expect($('h2.app-route-phase').length).toBe(4)
    expect($('.app-route-phase--current').text()).toContain('Private beta')
    expect($('.govuk-task-list__item').length).toBe(18)
  })

  test('the Service Design Pack lists items by group with their owners', async () => {
    const { payload } = await server.inject({
      method: 'GET',
      url: '/services/plant-export-checks/service-design-pack'
    })
    const $ = cheerio.load(payload)
    expect($('main h2').length).toBe(3)
    expect($('.govuk-task-list__item').length).toBe(24)
    expect(payload).toContain('No formal process exists yet')
  })

  test('a pack item shows its evidence link and an update button', async () => {
    const { payload } = await server.inject({
      method: 'GET',
      url: '/services/plant-export-checks/service-design-pack/service-tier'
    })
    const $ = cheerio.load(payload)
    expect($('h1').text()).toBe('Service tier')
    expect($('.govuk-summary-list a').attr('href')).toContain('service-tier.md')
    expect($('a.govuk-button').attr('href')).toBe(
      '/services/plant-export-checks/update/pack/service-tier'
    )
  })

  test('a journey step page names the journey', async () => {
    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: '/services/livestock-movement-notices/steps/pen-test?journey=keeper-reports-a-move'
    })
    const $ = cheerio.load(payload)
    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-caption-xl').text()).toContain('Keeper reports a move')
    expect($('a.govuk-button').attr('href')).toBe(
      '/services/livestock-movement-notices/update/step/pen-test?journey=keeper-reports-a-move'
    )
  })

  test('unknown services, steps and items are not found', async () => {
    const urls = [
      '/services/nope',
      '/services/plant-export-checks/steps/nope',
      '/services/plant-export-checks/service-design-pack/nope',
      '/services/plant-export-checks/update/step/nope',
      '/services/plant-export-checks/update/other/start-up'
    ]
    for (const url of urls) {
      const { statusCode } = await server.inject({ method: 'GET', url })
      expect(statusCode, url).toBe(statusCodes.notFound)
    }
  })

  test('the stamp question shows the current status checked', async () => {
    const { payload } = await server.inject({
      method: 'GET',
      url: '/services/plant-export-checks/update/step/pen-test'
    })
    const $ = cheerio.load(payload)
    expect($('legend').text()).toContain('What did the gate owner decide?')
    expect($('input[name="status"]:checked').val()).toBe('booked')
  })

  test('a missing decision shows an error summary', async () => {
    const response = await postForm(
      server,
      '/services/plant-export-checks/update/step/pen-test',
      {}
    )
    const $ = cheerio.load(response.payload)
    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary a').text()).toBe(
      'Select what the gate owner decided'
    )
    expect($('title').text()).toContain('Error:')
  })

  test('approved with conditions needs the conditions', async () => {
    const response = await postForm(
      server,
      '/services/plant-export-checks/update/step/pen-test',
      { status: 'approved-with-conditions', conditions: ' ' }
    )
    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect(response.payload).toContain('Enter the conditions')
  })

  test('a decision is saved and the step page confirms it', async () => {
    const response = await postForm(
      server,
      '/services/plant-export-checks/update/step/pen-test',
      { status: 'approved-with-conditions', conditions: 'Retest the upload' }
    )
    expect(response.statusCode).toBe(statusCodes.redirect)
    expect(response.headers.location).toBe(
      '/services/plant-export-checks/steps/pen-test?updated=true'
    )
    const stamp = getService('plant-export-checks').stamps.find(
      (entry) => entry.step === 'pen-test'
    )
    expect(stamp.status).toBe('approved-with-conditions')
    expect(stamp.conditions).toBe('Retest the upload')

    const page = await server.inject({
      method: 'GET',
      url: response.headers.location
    })
    expect(page.payload).toContain('Stamp updated')
    expect(page.payload).toContain('Retest the upload')
  })

  test('a journey decision is saved against that journey only', async () => {
    const response = await postForm(
      server,
      '/services/livestock-movement-notices/update/step/pen-test?journey=vet-certifies-a-move',
      { status: 'booked' }
    )
    expect(response.headers.location).toBe(
      '/services/livestock-movement-notices/steps/pen-test?journey=vet-certifies-a-move&updated=true'
    )
    const stamps = getService('livestock-movement-notices').stamps.filter(
      (entry) => entry.step === 'pen-test'
    )
    expect(stamps).toEqual([
      expect.objectContaining({
        journey: 'vet-certifies-a-move',
        status: 'booked'
      })
    ])
  })

  test('a pack item decision is saved', async () => {
    const response = await postForm(
      server,
      '/services/plant-export-checks/update/pack/soc-onboarding',
      { status: 'done' }
    )
    expect(response.headers.location).toBe(
      '/services/plant-export-checks/service-design-pack/soc-onboarding?updated=true'
    )
    expect(
      getService('plant-export-checks').pack.find(
        (entry) => entry.item === 'soc-onboarding'
      ).status
    ).toBe('done')
  })
})
