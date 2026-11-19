import * as cheerio from 'cheerio'

import { createServer } from '#/server/server.js'
import { data } from './controllers.js'

function text($, selector) {
  return $(selector).text().replace(/\s+/g, ' ').trim()
}

describe('Dashboard', () => {
  let server
  const originalStamps = data.stamps

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    data.stamps = originalStamps
  })

  async function get(url) {
    const response = await server.inject(url)
    expect(response.statusCode).toBe(200)
    return cheerio.load(response.payload)
  }

  test('defaults to the senior leader view with stamp-derived counts', async () => {
    const $ = await get('/dashboard')
    expect(text($, 'h1')).toBe('Dashboard')
    expect(text($, 'main')).toContain(data.service.caption)
    expect(text($, 'main')).toContain(data.service.targetGoLive)
    expect(text($, '[data-count="approved"]')).toBe(
      `${data.stamps.filter((stamp) => ['Approved', 'Approved with conditions'].includes(stamp.status)).length} of ${data.stamps.length}`
    )
    expect(text($, '[data-count="in-progress"]')).toBe(
      String(
        data.stamps.filter((stamp) => stamp.status === 'In progress').length
      )
    )
    expect(text($, '[data-count="not-started"]')).toBe(
      String(
        data.stamps.filter((stamp) => stamp.status === 'Not started').length
      )
    )
    expect($('.app-dashboard__journeys tbody tr')).toHaveLength(
      data.journeys.length
    )
    expect(text($, 'main')).toContain('Question for the architect')
    expect(text($, '.defra-service-navigation__link[aria-current]')).toBe(
      'Dashboard'
    )
    expect($('.defra-service-navigation a[href="/calendar"]')).toHaveLength(0)
    expect($('nav[aria-label="View as"] a[aria-current]').text()).toBe(
      'Senior leader'
    )
  })

  test('view links change content without JavaScript and preserve the journey', async () => {
    const senior = await get('/dashboard?journey=plants')
    const delivery = await get(
      senior('nav[aria-label="View as"] a').last().attr('href')
    )
    expect(text(delivery, '#selected-journey')).toBe('Plants')
    expect(text(delivery, 'main')).toContain('Next for your journey')
    expect(delivery('.app-dashboard__metrics')).toHaveLength(0)
    expect(delivery('.app-dashboard__journeys')).toHaveLength(0)
    expect(text(delivery, 'nav[aria-label="View as"] a[aria-current]')).toBe(
      'Delivery lead'
    )
    const back = await get(
      delivery('nav[aria-label="View as"] a').first().attr('href')
    )
    expect(back('.app-dashboard__metrics')).toHaveLength(1)
  })

  test('counts mixed stamp outcomes and derives the next-gate description from the pack stamp', async () => {
    const statuses = [
      'Approved',
      'Approved with conditions',
      'Booked',
      'Not started',
      'Submitted',
      'In progress',
      'Not approved',
      'Not started'
    ]
    data.stamps = originalStamps.map((stamp, index) => ({
      ...stamp,
      status: statuses[index]
    }))

    const $ = await get('/dashboard')
    expect(text($, '[data-count="approved"]')).toBe('2 of 8')
    expect(text($, '[data-count="in-progress"]')).toBe('1')
    expect(text($, '[data-count="not-started"]')).toBe('2')
    expect(text($, '.app-dashboard__card--gate')).toContain(
      'Stage Gate Pack: Approved'
    )
    expect(text($, '.app-dashboard__card--gate')).not.toContain('not started')
    const pack = $('table').first().find('tbody tr').first()
    expect(text($, pack.find('.govuk-tag'))).toBe('Approved')
  })

  test('keeps each journey stamp isolated in the senior and delivery views', async () => {
    const outcomes = [
      {
        id: 'live-animals',
        platform: 'Booked',
        accessibility: 'Submitted'
      },
      {
        id: 'plants',
        platform: 'Approved',
        accessibility: 'In progress'
      },
      {
        id: 'fish-import-service',
        platform: 'Not approved',
        accessibility: 'Approved with conditions'
      }
    ]
    data.stamps = originalStamps.map((stamp) => {
      const outcome = outcomes.find((item) => item.id === stamp.journeyId)
      if (!outcome) {
        return stamp
      }
      return {
        ...stamp,
        status:
          stamp.stepId === 'platform-readiness'
            ? outcome.platform
            : outcome.accessibility
      }
    })

    const senior = await get('/dashboard')
    for (const outcome of outcomes) {
      const journey = data.journeys.find((item) => item.id === outcome.id)
      const row = senior('.app-dashboard__journeys tbody tr').filter(
        (_, item) => senior(item).find('th').text().trim() === journey.name
      )
      expect(text(senior, row.find('td').eq(2).find('strong'))).toBe(
        outcome.platform
      )
      expect(text(senior, row.find('td').eq(3).find('strong'))).toBe(
        outcome.accessibility
      )

      const delivery = await get(
        `/dashboard?view=delivery&journey=${outcome.id}`
      )
      for (const [name, status] of [
        ['Platform Readiness Review', outcome.platform],
        ['Accessibility Review', outcome.accessibility]
      ]) {
        const step = delivery('.app-dashboard__steps li').filter(
          (_, item) => delivery(item).children('strong').first().text() === name
        )
        expect(text(delivery, step.find('.govuk-tag').first())).toBe(status)
      }
    }
  })

  test('delivery defaults to Live animals and journey links change the card and next steps', async () => {
    let $ = await get('/dashboard?view=delivery')
    expect(text($, '#selected-journey')).toBe('Live animals')
    expect(text($, '.app-dashboard__steps')).not.toContain(
      'Algorithmic Transparency'
    )
    for (const journey of data.journeys) {
      $ = await get(
        $(`nav[aria-label="Journey"] a[href$="journey=${journey.id}"]`).attr(
          'href'
        )
      )
      const card = $('#selected-journey').parent()
      expect(text($, '#selected-journey')).toBe(journey.name)
      expect(text($, card)).toContain(journey.supplier)
      expect(text($, card)).toContain(journey.lead)
      expect(text($, card)).toContain(journey.phase)
      expect(text($, card)).toContain(journey.note)
      expect(text($, 'nav[aria-label="Journey"] a[aria-current]')).toBe(
        journey.name
      )
    }
    expect(text($, '.app-dashboard__steps')).toContain(
      'Algorithmic Transparency Recording Standard record'
    )
    expect(text($, '.app-dashboard__steps')).toContain('to confirm')
  })

  test.each(['senior', 'delivery'])(
    '%s includes the shared service table, waits and open questions',
    async (view) => {
      const $ = await get(`/dashboard?view=${view}`)
      const rows = $('table').first().find('tbody tr')
      expect(rows).toHaveLength(3)
      for (const stamp of data.stamps.filter((item) => !item.journeyId)) {
        const step = data.steps.find((item) => item.id === stamp.stepId)
        const row = rows.filter((_, item) => text($, item).includes(step.name))
        expect(text($, row)).toContain(step.owner)
        expect(text($, row)).toContain(stamp.status)
      }
      for (const wait of data.waits) {
        expect(text($, 'main')).toContain(wait.name)
        expect(text($, 'main')).toContain(wait.timing)
      }
      for (const question of data.questions) {
        expect(text($, '.app-dashboard__questions')).toContain(question.detail)
      }
      expect($('table th:not([scope])')).toHaveLength(0)
      expect($('.app-dashboard__table-scroll[tabindex="0"]')).toHaveLength(
        $('table').length
      )
    }
  )

  test('the full route lists every step in data order and returns to the selected view and journey', async () => {
    const $ = await get('/dashboard?view=delivery&journey=fish-import-service')
    const route = await get(
      $('a')
        .filter((_, item) => $(item).text() === 'See the full route')
        .attr('href')
    )
    expect(
      route('.app-dashboard__steps h2')
        .map((_, item) => route(item).text())
        .get()
    ).toEqual(data.steps.map((step) => step.name))
    const returned = await get(route('.govuk-back-link').attr('href'))
    expect(text(returned, '#selected-journey')).toBe('Fish Import Service')
    expect(text(returned, 'nav[aria-label="View as"] a[aria-current]')).toBe(
      'Delivery lead'
    )
  })

  test.each([
    '/dashboard?view=unknown',
    '/dashboard?journey=unknown',
    '/dashboard/route?view=unknown',
    '/dashboard/route?journey=unknown'
  ])('rejects invalid selection %s explicitly', async (url) => {
    expect((await server.inject(url)).statusCode).toBe(400)
  })
})
