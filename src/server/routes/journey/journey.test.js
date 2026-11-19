import * as cheerio from 'cheerio'

import { createServer } from '#/server/server.js'
import {
  answerAboutPassport,
  answerQuestion,
  buildRoute,
  data,
  longDate,
  nameInSentence,
  nextStep,
  suggestedAnswers,
  syncStamps
} from './passport-state.js'

/** One visitor: keeps the session cookie and sends the CSRF crumb. */
function visitor(server) {
  const jar = new Map()

  function remember(response) {
    for (const cookie of [response.headers['set-cookie'] ?? []].flat()) {
      const [pair] = cookie.split(';')
      const [name, ...value] = pair.split('=')
      jar.set(name, value.join('='))
    }
  }

  function cookie() {
    return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
  }

  async function get(url) {
    const response = await server.inject({
      method: 'GET',
      url,
      headers: { cookie: cookie() }
    })
    remember(response)
    return { ...response, $: cheerio.load(response.payload) }
  }

  async function post(url, payload = {}, from = url) {
    const page = await get(from)
    const crumb = page.payload.match(/name="crumb" value="([^"]+)"/)[1]
    const response = await server.inject({
      method: 'POST',
      url,
      headers: { cookie: cookie() },
      payload: { crumb, ...payload }
    })
    remember(response)
    return { ...response, $: cheerio.load(response.payload) }
  }

  return { get, post }
}

const goLive = { goLiveDay: '30', goLiveMonth: '3', goLiveYear: '2027' }
const plant = 'plant-export-checks'

async function setUp(person, service = plant) {
  await person.post('/about-your-service', { cdpService: service })
  await person.post('/about-your-service/go-live', goLive)
  return person.post('/about-your-service/check')
}

function text($, selector) {
  return $(selector).text().replace(/\s+/g, ' ').trim()
}

function taskStatus($, name) {
  const row = $('.govuk-task-list__item').filter((_, item) =>
    text($, $(item).find('.govuk-task-list__name-and-hint')).startsWith(name)
  )
  return {
    status: text($, row.find('.govuk-task-list__status')),
    hint: text($, row.find('.govuk-task-list__hint')),
    linked: row.find('a').length > 0
  }
}

describe('The Service Passport journey', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('before a passport is set up', () => {
    test('the start page leads to finding your services on CDP', async () => {
      const person = visitor(server)
      const start = await person.get('/')
      expect(text(start.$, 'h1')).toBe('Service Passport')
      expect(text(start.$, 'main')).toContain(
        'You need your Defra account and your target go-live date.'
      )
      expect(start.$('a.govuk-button--start').attr('href')).toBe('/connect')
      expect(
        start
          .$('.defra-service-navigation__link')
          .map((i, link) => start.$(link).text())
          .get()
      ).toEqual(['Passport', 'Dashboard', 'Service', 'Ask'])
    })

    test.each(['/passport', '/calendar'])(
      '%s says the passport is not set up yet and links to set-up',
      async (path) => {
        const person = visitor(server)
        const page = await person.get(path)
        expect(page.statusCode).toBe(200)
        expect(text(page.$, 'h1')).toBe('You have not set up a passport yet')
        expect(page.$('main a.govuk-button').attr('href')).toBe('/connect')

        await person.post('/about-your-service', { cdpService: plant })
        const resumed = await person.get(path)
        expect(text(resumed.$, 'main a.govuk-button')).toBe(
          'Continue setting up'
        )
      }
    )

    test('finding your services shows the sign-in, the team and its services', async () => {
      const person = visitor(server)
      const { $ } = await person.get('/connect')
      expect(text($, 'h1')).toBe('Finding your services on CDP')
      const tasks = $('.govuk-task-list__item')
        .map((_, item) => text($, item))
        .get()
      expect(tasks).toEqual([
        'Sign in with your Defra account Signed in Done',
        'Find your team on CDP Plant health digital Done',
        'Find the services your team owns 3 services Done'
      ])
      expect($('[data-progress-live]').attr('data-progress-live')).toBe(
        'Found 3 services owned by Plant health digital.'
      )
      expect($('[data-progress-after] a.govuk-button').attr('href')).toBe(
        '/about-your-service'
      )
    })

    test('choosing no service names the problem', async () => {
      const person = visitor(server)
      const { $ } = await person.post('/about-your-service')
      expect(text($, '.govuk-error-summary')).toContain(
        'Select the service the passport is for'
      )
    })

    test.each([
      [
        { goLiveDay: '16', goLiveMonth: '', goLiveYear: '2027' },
        'Target go-live date must include a month'
      ],
      [
        { goLiveDay: '', goLiveMonth: '', goLiveYear: '' },
        'Enter your target go-live date'
      ],
      [
        { goLiveDay: '31', goLiveMonth: '2', goLiveYear: '2027' },
        'Target go-live date must be a real date'
      ],
      [
        { goLiveDay: '1', goLiveMonth: '1', goLiveYear: '2026' },
        'Target go-live date must be in the future'
      ]
    ])('go-live date %o gives "%s"', async (values, message) => {
      const person = visitor(server)
      await person.post('/about-your-service', { cdpService: plant })
      const { $ } = await person.post('/about-your-service/go-live', values)
      expect(text($, '.govuk-error-summary')).toContain(message)
      expect($('title').text()).toMatch(/^Error: /)
    })

    test('after the go-live date, AI reads the service before showing what it found', async () => {
      const person = visitor(server)
      await person.post('/about-your-service', { cdpService: plant })
      const saved = await person.post('/about-your-service/go-live', goLive)
      expect(saved.headers.location).toBe('/about-your-service/reading')
      const { $ } = await person.get('/about-your-service/reading')
      expect(text($, 'h1')).toBe('Reading your service on CDP')
      expect(taskStatus($, 'Read your code on GitHub')).toMatchObject({
        status: 'Done',
        hint: 'DEFRA/example-plant-export-checks-frontend'
      })
      expect(taskStatus($, 'Read your deployments on CDP').hint).toBe(
        'Version 0.50.0, deployed 3 November 2026'
      )
      expect(taskStatus($, 'Suggest answers').hint).toBe('Found all 6')
      expect($('[data-progress-after] a').attr('href')).toBe(
        '/about-your-service/check'
      )
      expect($('[data-next]')).toHaveLength(0)
    })

    test('reading a service says how many answers AI could not find', async () => {
      const person = visitor(server)
      await person.post('/about-your-service', {
        cdpService: 'livestock-movements'
      })
      await person.post('/about-your-service/go-live', goLive)
      const { $ } = await person.get('/about-your-service/reading')
      expect(taskStatus($, 'Suggest answers').hint).toBe(
        'Found 5 of 6. You answer the other one'
      )
    })

    test('the check page puts the service first, then what AI found', async () => {
      const person = visitor(server)
      await person.post('/about-your-service', { cdpService: plant })
      await person.post('/about-your-service/go-live', goLive)
      const { $ } = await person.get('/about-your-service/check')
      const order = $('main h1, main h2, main .govuk-summary-list')
        .map((_, el) =>
          el.tagName === 'dl'
            ? $(el).find('dt').first().text().trim()
            : text($, el)
        )
        .get()
      expect(order).toEqual([
        'Check what AI found',
        'Service',
        'What AI found',
        'Used by people outside Defra'
      ])
    })

    test('the check page shows what AI found and where it found it', async () => {
      const person = visitor(server)
      await person.post('/about-your-service', { cdpService: plant })
      await person.post('/about-your-service/go-live', goLive)
      const { $ } = await person.get('/about-your-service/check')
      expect(text($, 'h1')).toBe('Check what AI found')
      const row = text(
        $,
        '.govuk-summary-list__row:has(#change-supplierPenTest)'
      )
      expect(row).toContain(
        'Supplier named in the test scope, in ithc-scope.md'
      )
      expect(
        text(
          $,
          '.govuk-summary-list__row:has(#change-supplierPenTest) .app-effect'
        )
      ).toBe('Book 8 weeks ahead')
      expect(
        text($, '.govuk-summary-list__row:has(#change-public) .app-effect')
      ).toBe('Adds a beta assessment')
    })

    test('when AI could not find an answer, the person must answer before confirming', async () => {
      const person = visitor(server)
      const confirm = await setUp(person, 'livestock-movements')
      expect(confirm.statusCode).toBe(200)
      expect(text(confirm.$, '.govuk-error-summary')).toContain(
        'Select yes if an external supplier will run your IT health check'
      )
      expect(confirm.$('.govuk-error-summary a').attr('href')).toBe(
        '#change-supplierPenTest'
      )
      expect(confirm.$('#change-supplierPenTest').length).toBe(1)

      await person.post('/about-your-service/supplierPenTest', { answer: 'no' })
      const check = await person.get('/about-your-service/check')
      expect(text(check.$, 'main')).toContain('Not found. You answered it.')
      const done = await person.post('/about-your-service/check')
      expect(done.headers.location).toBe('/passport')
    })

    test('changing an answer back to what AI suggested no longer says it was changed', async () => {
      const person = visitor(server)
      await person.post('/about-your-service', { cdpService: plant })
      await person.post('/about-your-service/go-live', goLive)
      await person.post('/about-your-service/usesAi', { answer: 'yes' })
      let check = await person.get('/about-your-service/check')
      expect(text(check.$, 'main')).toContain(
        'AI suggested no. You changed it.'
      )
      await person.post('/about-your-service/usesAi', { answer: 'no' })
      check = await person.get('/about-your-service/check')
      expect(text(check.$, 'main')).not.toContain('You changed it.')
    })

    test('a question with no answer selected names the problem', async () => {
      const person = visitor(server)
      await person.post('/about-your-service', { cdpService: plant })
      await person.post('/about-your-service/go-live', goLive)
      const { $ } = await person.post('/about-your-service/public')
      expect(text($, '.govuk-error-summary')).toContain(
        'Select yes if people outside Defra will use the service'
      )
      const done = await person.post('/about-your-service/alreadyDone')
      expect(text(done.$, '.govuk-error-summary')).toContain(
        'select none of these'
      )
    })
  })

  describe('with a passport set up', () => {
    let person

    beforeEach(async () => {
      person = visitor(server)
      await setUp(person)
    })

    test('the passport flags the overdue booking, the next one and what cannot start yet', async () => {
      const { $ } = await person.get('/passport')
      expect(text($, '.govuk-notification-banner')).toContain(
        'Your passport is set up'
      )
      expect(text($, '.govuk-warning-text')).toContain(
        'Book your IT health check now. It was due by 10 November 2026.'
      )
      expect(text($, '.govuk-inset-text')).toBe(
        'Next: book your accessibility audit by 24 November 2026.'
      )
      expect(taskStatus($, 'IT health check')).toEqual({
        status: 'Overdue',
        hint: 'Was due by 10 November 2026',
        linked: true
      })
      expect(taskStatus($, 'Change request')).toEqual({
        status: 'Cannot start yet',
        hint: 'After stage gate 4',
        linked: false
      })
      expect(taskStatus($, 'Solution Design Authority').hint).toBe(
        'Decided 22 July 2026'
      )
    })

    test('the header and the start page lead back to the passport', async () => {
      const { $ } = await person.get('/')
      expect($('.defra-header__service-name').attr('href')).toBe('/passport')
      expect(text($, 'main')).toContain('Go to your passport')
      expect($('a.govuk-button--start').length).toBe(0)
    })

    test('the plan groups dates by month, with the milestones in order', async () => {
      const { $ } = await person.get('/calendar')
      expect(text($, 'main')).toContain('Today is 16 November 2026.')
      const months = $('h2.app-task-list-heading')
        .map((_, heading) => text($, heading))
        .get()
      expect(months.slice(0, 3)).toEqual([
        'This month',
        'Next month',
        'January 2027'
      ])
      expect(months.at(-1)).toBe('March 2027')
      const items = $('.govuk-task-list__name-and-hint')
        .map((_, item) => text($, $(item).children().first()))
        .get()
      expect(items[0]).toBe('Book your IT health check')
      expect(items).toContain('Send your stage gate 4 papers')
      expect(items).not.toContain('Stage gate 4 papers due')
      expect(items).toContain('Stage gate 4 board, latest date')
      expect(items.at(-1)).toBe('Target go-live')
      expect(taskStatus($, 'Book your IT health check').hint).toBe(
        'By 10 November'
      )
    })

    test('sharing sits at the foot of the passport, not with its facts', async () => {
      const { $ } = await person.get('/passport')
      expect($('.app-facts').text()).not.toContain('Share')
      expect($('a[href="/passport/share"]').text()).toBe('Get a link')
    })

    test('the step page explains its book by date', async () => {
      const { $ } = await person.get('/passport/pen-test')
      expect(text($, '.govuk-details__summary')).toBe(
        'Why book by 10 November 2026?'
      )
      expect(text($, '.govuk-details')).toContain(
        'That is 12 weeks, plus 2 for Christmas, so book 14 weeks before you send your stage gate 4 papers on 16 February 2027.'
      )
    })

    test('booking needs a date, and the date shows on the passport', async () => {
      const missing = await person.post('/passport/pen-test/status', {
        status: 'booked'
      })
      expect(text(missing.$, '.govuk-error-summary')).toContain(
        'Enter the date of your IT health check'
      )
      const saved = await person.post('/passport/pen-test/status', {
        status: 'booked',
        bookedForDay: '19',
        bookedForMonth: '1',
        bookedForYear: '2027'
      })
      expect(saved.headers.location).toBe('/passport')
      const { $ } = await person.get('/passport')
      expect(text($, '.govuk-notification-banner')).toContain(
        'IT health check booked for 19 January 2027'
      )
      expect(taskStatus($, 'IT health check')).toMatchObject({
        status: 'Booked',
        hint: 'Booked for 19 January 2027'
      })
      expect($('.govuk-warning-text').length).toBe(0)
    })

    test('a booking too late for the stage gate 4 papers is flagged', async () => {
      await person.post('/passport/pen-test/status', {
        status: 'booked',
        bookedForDay: '1',
        bookedForMonth: '6',
        bookedForYear: '2027'
      })
      const { $ } = await person.get('/passport')
      expect(text($, '.govuk-notification-banner')).toContain(
        'Your IT health check on 1 June 2027 is too late'
      )
      expect(taskStatus($, 'IT health check').status).toBe('Booked too late')
      expect(text($, '.govuk-warning-text')).toContain(
        'Your IT health check on 1 June 2027 is too late for your stage gate 4 papers on 16 February 2027'
      )
    })

    test('a date with a missing part links to that part', async () => {
      const { $ } = await person.post('/passport/pen-test/status', {
        status: 'booked',
        bookedForDay: '4',
        bookedForYear: '2027'
      })
      expect($('.govuk-error-summary a').attr('href')).toBe('#bookedFor-month')
      expect($('#bookedFor').hasClass('govuk-input--error')).toBe(false)
      expect($('#bookedFor-month').hasClass('govuk-input--error')).toBe(true)
    })

    test('the delivery lead cannot change a decision through the status page', async () => {
      const page = await person.get(
        '/passport/solution-design-authority/status'
      )
      expect(page.headers.location).toBe('/passport/solution-design-authority')
      const saved = await person.post(
        '/passport/solution-design-authority/status',
        { status: 'not-started' },
        '/passport/solution-design-authority'
      )
      expect(saved.headers.location).toBe('/passport/solution-design-authority')
      const { $ } = await person.get('/passport')
      expect(taskStatus($, 'Solution Design Authority').status).toBe('Done')
    })

    test('stage gate 4 papers cannot be sent while other steps are open', async () => {
      const { $ } = await person.get('/passport/gate-4/status')
      const values = $('input[name="status"]')
        .map((_, input) => $(input).val())
        .get()
      expect(values).toEqual(['not-started', 'in-progress'])
      expect(text($, '.govuk-inset-text')).toContain(
        'Still open: Service Design Review Board'
      )
    })

    test('a step sent back shows the reason, then conditions keep it open until met', async () => {
      const prr = '/passport/platform-readiness-review'
      await person.post(`${prr}/status`, { status: 'submitted' })
      await person.post(`${prr}/decision`, { decision: 'reject' }, prr)
      let passport = await person.get('/passport')
      expect(text(passport.$, '.govuk-notification-banner')).toContain(
        'The CDP platform team did not approve your Platform Readiness Review'
      )
      expect(taskStatus(passport.$, 'Platform Readiness Review').status).toBe(
        'Not approved'
      )

      await person.post(`${prr}/status`, { status: 'submitted' })
      await person.post(`${prr}/decision`, { decision: 'conditions' }, prr)
      passport = await person.get('/passport')
      expect(taskStatus(passport.$, 'Platform Readiness Review')).toMatchObject(
        {
          status: 'Conditions open',
          hint: '1 condition to meet before go-live'
        }
      )

      const bad = await person.post(`${prr}/conditions/0`, { link: 'runbook' })
      expect(text(bad.$, '.govuk-error-summary')).toContain(
        'Enter a link that starts with https://'
      )
      await person.post(`${prr}/conditions/0`, {
        link: 'https://github.com/DEFRA/example/blob/main/docs/runbook.md'
      })
      passport = await person.get('/passport')
      expect(taskStatus(passport.$, 'Platform Readiness Review')).toMatchObject(
        {
          status: 'Evidence sent',
          hint: '1 condition waiting for the CDP platform team to confirm'
        }
      )

      await person.post(`${prr}/conditions/0/confirm`, {}, prr)
      passport = await person.get('/passport')
      expect(taskStatus(passport.$, 'Platform Readiness Review')).toMatchObject(
        {
          status: 'Approved, conditions met',
          hint: 'Decided 16 November 2026'
        }
      )

      const step = await person.get(prr)
      expect(text(step.$, 'main')).toContain(
        'Not approved by the CDP platform team. From their decision record. Reason: No test coverage report.'
      )
      const record = await person.get(`${prr}/record`)
      expect(text(record.$, 'h1')).toBe('Decision record')
    })

    test('a decision on a step that has not been sent changes nothing', async () => {
      const response = await person.post(
        '/passport/pen-test/decision',
        { decision: 'approve' },
        '/passport/pen-test'
      )
      expect(response.headers.location).toBe('/passport/pen-test')
      const { $ } = await person.get('/passport')
      expect(taskStatus($, 'IT health check').status).toBe('Overdue')
    })

    test('unticking a decision AI found takes it off the passport', async () => {
      await person.post('/about-your-service/alreadyDone', {
        alreadyDone: ['service-tiering', 'solution-design-authority']
      })
      const check = await person.get('/about-your-service/check')
      expect(text(check.$, '.govuk-notification-banner')).toContain(
        'Registration with the Portfolio Office: no longer marked as done. Overdue: it was due before private beta.'
      )
      const { $ } = await person.get('/passport')
      expect(
        taskStatus($, 'Registration with the Portfolio Office').status
      ).toBe('Overdue')
      expect(text($, '.app-history')).toContain(
        '16 November 2026 You changed "Approvals already given". Registration with the Portfolio Office: no longer marked as done.'
      )
    })

    test('a decision ticked without evidence asks for it, and records it', async () => {
      await person.post('/about-your-service/nonStandardTools', {
        answer: 'yes'
      })
      const changed = await person.get('/about-your-service/check')
      expect(text(changed.$, '.govuk-notification-banner')).toContain(
        'Added: Technical Design Authority. Overdue: it was due by 13 October 2026.'
      )
      await person.post('/about-your-service/alreadyDone', {
        alreadyDone: ['registration', 'technical-design-authority']
      })
      const tda = '/passport/technical-design-authority'
      let step = await person.get(tda)
      expect(text(step.$, 'main')).toContain('No evidence linked')
      const before = await person.get('/passport')
      expect(taskStatus(before.$, 'Technical Design Authority').status).toBe(
        'Evidence needed'
      )

      const bad = await person.post(`${tda}/evidence`, { link: '' })
      expect(text(bad.$, '.govuk-error-summary')).toContain(
        'Enter the date of the decision'
      )
      expect(text(bad.$, '.govuk-error-summary')).toContain(
        'Enter a link to the evidence'
      )
      await person.post(`${tda}/evidence`, {
        decidedOnDay: '1',
        decidedOnMonth: '10',
        decidedOnYear: '2026',
        link: 'https://sharepoint.example/tda-minutes'
      })
      step = await person.get(tda)
      expect(
        step.$('a[href="https://sharepoint.example/tda-minutes"]').length
      ).toBe(1)
    })

    test('a new go-live date moves every date and says how many are overdue', async () => {
      await person.post('/about-your-service/go-live', {
        goLiveDay: '1',
        goLiveMonth: '2',
        goLiveYear: '2027'
      })
      const { $ } = await person.get('/about-your-service/check')
      expect(text($, '.govuk-notification-banner')).toContain(
        'Every date is now worked back from 1 February 2027.'
      )
      expect(text($, '.govuk-notification-banner')).toMatch(
        /\d steps are overdue/
      )
    })

    test('AI checks the service is ready only when asked, and the passport counts what to fix', async () => {
      const before = await person.get('/passport/pen-test')
      expect(text(before.$, '#readiness + p')).toContain(
        'AI checks your code and the CDP portal'
      )
      expect(before.$('.app-readiness').length).toBe(0)

      const response = await person.post(
        '/passport/pen-test/readiness',
        {},
        '/passport/pen-test'
      )
      expect(response.headers.location).toBe('/passport/pen-test#readiness')

      const { $ } = await person.get('/passport/pen-test')
      expect(text($, '#readiness + p')).toBe(
        'AI found 1 thing to fix before you book. Check 1 thing yourself. Checked 16 November 2026.'
      )
      expect(taskStatus($, 'No known vulnerabilities').status).toBe('To fix')
      expect(taskStatus($, 'Test accounts for the testers').status).toBe(
        'Check yourself'
      )
      expect(taskStatus($, 'Scope agreed with the testers').status).toBe(
        'Ready'
      )

      const passport = await person.get('/passport')
      expect(taskStatus(passport.$, 'IT health check').hint).toBe(
        'Was due by 10 November 2026. 1 thing to fix first'
      )
    })

    test('the Platform Readiness Review checks the service is in production', async () => {
      const prr = '/passport/platform-readiness-review'
      await person.post(`${prr}/readiness`, {}, prr)
      const { $ } = await person.get(prr)
      expect(text($, '.govuk-summary-list')).toContain(
        'In production Version 0.50.0 since 3 November 2026'
      )
      const deployed = taskStatus($, 'Deployed to production')
      expect(deployed.status).toBe('Ready')
      expect(deployed.hint).toBe(
        'Version 0.50.0 since 3 November 2026, in the CDP portal.'
      )
    })

    test('a step without readiness checks cannot be checked', async () => {
      const response = await person.post(
        '/passport/gate-4/readiness',
        {},
        '/passport/gate-4'
      )
      expect(response.headers.location).toBe('/passport/gate-4')
    })

    test('time passing makes the next bookings overdue', async () => {
      await person.post('/passport/time-passes', {}, '/passport')
      const { $ } = await person.get('/passport')
      expect(text($, '.govuk-notification-banner')).toContain(
        'It is now 30 November 2026'
      )
      expect(taskStatus($, 'Accessibility audit').status).toBe('Overdue')
    })

    test('when every step is approved, the passport says so and can be shared', async () => {
      await person.post('/passport/approve-everything', {}, '/passport')
      const { $ } = await person.get('/passport')
      expect(text($, '.govuk-notification-banner')).toContain(
        'Every step on your route is approved'
      )
      expect(taskStatus($, 'Stage gate 4').hint).toBe('Decided 2 March 2027')
      expect(text($, '.app-prototype-controls')).toContain(
        'Today is 29 March 2027 in this prototype.'
      )
      const share = await person.get('/passport/share')
      expect(share.$('#link').val()).toMatch(/\/passport$/)
    })

    test('Ask sits in the navigation and step pages link to it', async () => {
      const passport = await person.get('/passport')
      expect(passport.$('#question').length).toBe(0)
      const ask = await person.get('/passport/ask')
      expect(
        ask.$('.defra-service-navigation__link[aria-current="page"]').text()
      ).toBe('Ask')
      const sdrb = await person.get('/passport/service-design-review-board')
      expect(
        sdrb
          .$('a[href="/passport/ask?step=service-design-review-board"]')
          .text()
      ).toBe('Ask about this step')
      expect(sdrb.$('#question').length).toBe(0)
    })

    test('asking about a step answers from its guidance and links to it', async () => {
      const ask = '/passport/ask?step=service-design-review-board'
      const empty = await person.post(
        ask,
        { question: ' ', step: 'service-design-review-board' },
        ask
      )
      expect(text(empty.$, '.govuk-error-summary')).toContain(
        'Enter your question'
      )

      for (const question of [
        'Can I send the pack in parts?',
        'Why is the coffee machine broken?',
        'Can the board see the pack early?'
      ]) {
        await person.post(
          ask,
          { question, step: 'service-design-review-board' },
          ask
        )
      }
      const { $ } = await person.get(ask)
      const answers = $('.app-ask__answer')
      expect(text($, answers.eq(0))).toContain(
        'reviews each section as you finish it'
      )
      expect(
        answers.eq(0).find('a[href="/guidance/service-design-pack-guidance"]')
          .length
      ).toBe(1)
      expect(text($, answers.eq(1))).toContain(
        'AI could not find an answer in your passport or its guidance. Ask your service transition manager.'
      )
      expect(text($, answers.eq(2))).toContain('AI could not find an answer')

      const guidance = await person.get(
        '/guidance/service-design-pack-guidance'
      )
      expect(text(guidance.$, 'h1')).toBe('Service Design Pack guidance')
      const unknown = await person.get('/guidance/nothing')
      expect(unknown.headers.location).toBe('/')
    })

    test('starting again clears the passport', async () => {
      await person.post('/start-again', {}, '/')
      const passport = await person.get('/passport')
      expect(text(passport.$, 'h1')).toBe('You have not set up a passport yet')
    })

    test('a go-live date too soon for stage gate 4 is called out', async () => {
      await person.post('/about-your-service/go-live', {
        goLiveDay: '17',
        goLiveMonth: '11',
        goLiveYear: '2026'
      })
      const { $ } = await person.get('/passport')
      expect(text($, '.govuk-warning-text')).toContain(
        'Your target go-live date of 17 November 2026 is not possible. Stage gate 4 would have needed to meet by 20 October 2026.'
      )
    })
  })
})

describe('The passport rules', () => {
  const state = (goLiveDate, extra = {}) => {
    const answers = suggestedAnswers(data.cdpServices[0])
    return {
      about: { cdpService: 'plant-export-checks', goLive: goLiveDate },
      answers,
      stamps: syncStamps({}, answers, data.cdpServices[0], data.demoToday),
      ...extra
    }
  }

  test('a book by date that falls on a weekend moves to the Friday before', () => {
    const route = buildRoute(state('2027-03-13'))
    const step = route.steps.find((item) => item.id === 'gate-4')
    expect(step.plan.actionBy).toBe('2027-01-29')
  })

  test('a step that was not approved stops the stage gate 4 papers', () => {
    const base = state('2027-03-30')
    const route = buildRoute({
      ...base,
      stamps: {
        ...base.stamps,
        'pen-test': { status: 'not-approved', decidedOn: '2026-11-16' }
      }
    })
    const gate4 = route.steps.find((item) => item.id === 'gate-4')
    expect(gate4.sendBlockers.map((item) => item.id)).toContain('pen-test')
  })

  test('the next step skips anything already overdue', () => {
    const route = buildRoute(state('2027-03-30'))
    expect(nextStep(route).id).toBe('accessibility-audit')
  })

  test('each example question gets its own answer', () => {
    for (const step of data.steps.filter((item) => item.examples)) {
      for (const [index, example] of step.examples.entries()) {
        const answer = answerQuestion(step, example)
        expect(answer.found).toBe(true)
        expect(answer.paragraphs).toEqual(step.answers[index].paragraphs)
      }
    }
  })

  test('a question that matches one word of an answer is not answered', () => {
    const step = data.steps.find(
      (item) => item.id === 'service-design-review-board'
    )
    expect(answerQuestion(step, 'Why is it raining?').found).toBe(false)
  })

  test('questions about the route are answered from the passport', () => {
    const route = buildRoute(state('2027-03-30'))
    const next = answerAboutPassport(route, 'What should I book next?', null)
    expect(next.source.href).toBe('/passport')
    expect(next.paragraphs[0]).toBe(
      `${nextStep(route).todo} by ${longDate(nextStep(route).plan.actionBy)}.`
    )
    const left = answerAboutPassport(
      route,
      'What is left before go-live?',
      null
    )
    expect(left.bullets).toHaveLength(route.stepsLeft)
  })

  test('why a step is on the route quotes the question that put it there', () => {
    const route = buildRoute(state('2027-03-30'))
    const step = route.steps.find(
      (item) => data.steps.find((s) => s.id === item.id).when
    )
    const answer = answerAboutPassport(
      route,
      `Why do I need the ${step.name}?`,
      null
    )
    const rule = Object.keys(data.steps.find((s) => s.id === step.id).when)[0]
    const asked = data.questions.find((q) => q.id === rule).question
    expect(answer.paragraphs[0]).toBe(
      `It is on your route because you answered yes to "${asked}".`
    )
  })

  test('a question about nothing on the passport says so', () => {
    const route = buildRoute(state('2027-03-30'))
    const answer = answerAboutPassport(route, 'Why is it raining?', null)
    expect(answer.found).toBe(false)
    expect(answer.paragraphs[0]).toContain(
      'Ask your service transition manager'
    )
  })

  test.each([
    ['Accessibility audit', 'accessibility audit'],
    ['Platform Readiness Review', 'Platform Readiness Review'],
    ['IT health check', 'IT health check'],
    ['Stage gate 4', 'stage gate 4']
  ])('"%s" reads as "%s" mid-sentence', (name, expected) => {
    expect(nameInSentence(name)).toBe(expected)
  })
})
