import * as cheerio from 'cheerio'

import { createServer } from '#/server/server.js'
import {
  answerQuestion,
  buildRoute,
  data,
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
    test('the start page offers to start, and the passport sends people back to it', async () => {
      const person = visitor(server)
      const start = await person.get('/')
      expect(text(start.$, 'h1')).toBe('Service Passport')
      expect(start.$('a.govuk-button--start').attr('href')).toBe(
        '/about-your-service'
      )

      const passport = await person.get('/passport')
      expect(passport.statusCode).toBe(302)
      expect(passport.headers.location).toBe('/')
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

    test('the check page shows what AI found and where it found it', async () => {
      const person = visitor(server)
      await person.post('/about-your-service', { cdpService: plant })
      await person.post('/about-your-service/go-live', goLive)
      const { $ } = await person.get('/about-your-service/check')
      expect(text($, 'h1')).toBe('Check your answers')
      expect(text($, 'main')).toContain(
        'docs/security/ithc-scope.md names an IT health check supplier'
      )
      expect(text($, 'main')).toContain('From your README')
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
      expect(text(check.$, 'main')).toContain(
        'AI could not find this. You answered it.'
      )
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

    test('the plan lists dates in order, with today and the milestones', async () => {
      const { $ } = await person.get('/plan')
      const rows = $('tbody tr')
        .map((_, row) => text($, $(row).find('td').first()))
        .get()
      expect(rows[0]).toBe('Book your IT health check')
      expect(rows[1]).toBe('Today')
      expect(rows).toContain('Stage gate 4 papers due')
      expect(rows).toContain('Stage gate 4 board, latest date')
      expect(rows.at(-1)).toBe('Target go-live')
    })

    test('the step page explains its book by date', async () => {
      const { $ } = await person.get('/passport/pen-test')
      expect(text($, '.govuk-details__summary')).toBe(
        'Why book by 10 November 2026?'
      )
      expect(text($, '.govuk-details')).toContain(
        'We added 2 weeks because the work runs over Christmas, so book 14 weeks before you send your stage gate 4 papers on 16 February 2027.'
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
      expect(text($, '.govuk-inset-text')).toContain('6 are still open')
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

    test('time passing makes the next bookings overdue', async () => {
      await person.post('/passport/time-passes', {}, '/passport')
      const { $ } = await person.get('/passport')
      expect(text($, '.govuk-notification-banner')).toContain(
        'The demo date is now 30 November 2026'
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
        'The demo date is 29 March 2027'
      )
      const share = await person.get('/passport/share')
      expect(share.$('#link').val()).toMatch(/\/passport$/)
    })

    test('asking about a step answers from its guidance and links to it', async () => {
      const sdrb = '/passport/service-design-review-board'
      const empty = await person.post(`${sdrb}/ask`, { question: ' ' }, sdrb)
      expect(text(empty.$, '.govuk-error-summary')).toContain(
        'Enter your question'
      )

      await person.post(
        `${sdrb}/ask`,
        { question: 'Can I send the pack in parts?' },
        sdrb
      )
      await person.post(
        `${sdrb}/ask`,
        { question: 'Why is the coffee machine broken?' },
        sdrb
      )
      const { $ } = await person.get(sdrb)
      const answers = $('.app-ask__answer')
      expect(text($, answers.eq(0))).toContain(
        'reviews each section as you finish it'
      )
      expect(
        answers.eq(0).find('a[href="/guidance/service-design-pack-guidance"]')
          .length
      ).toBe(1)
      expect(text($, answers.eq(1))).toContain(
        'AI could not find an answer to that in the Service Design Pack guidance. Ask your service transition manager.'
      )

      await person.post(
        `${sdrb}/ask`,
        { question: 'Can the board see the pack early?' },
        sdrb
      )
      const third = await person.get(sdrb)
      expect(text(third.$, third.$('.app-ask__answer').eq(2))).toContain(
        'AI could not find an answer'
      )

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
      expect(passport.headers.location).toBe('/')
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

  test.each([
    ['Accessibility audit', 'accessibility audit'],
    ['Platform Readiness Review', 'Platform Readiness Review'],
    ['IT health check', 'IT health check'],
    ['Stage gate 4', 'stage gate 4']
  ])('"%s" reads as "%s" mid-sentence', (name, expected) => {
    expect(nameInSentence(name)).toBe(expected)
  })
})
