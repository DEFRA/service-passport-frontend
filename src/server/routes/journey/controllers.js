import {
  addDays,
  answerQuestion,
  buildRoute,
  clearState,
  data,
  findCdpService,
  findStep,
  getState,
  historyEntry,
  longDate,
  nextStep,
  plannedDecision,
  plural,
  setState,
  suggestedAnswers,
  syncStamps,
  today,
  unansweredQuestions
} from './passport-state.js'

const views = 'journey/views'
const maxQuestionLength = 500
const maxLinkLength = 2000
const demoStepDays = 14
const outcomeWords = {
  approved: 'Approved',
  'approved-with-conditions': 'Approved with conditions',
  'not-approved': 'Not approved'
}

/** Sends anyone without a confirmed route back to the start page. */
function needsRoute(handler) {
  return (request, h) => {
    const state = getState(request)
    if (!state.confirmed) {
      return h.redirect('/')
    }
    return handler(request, h, state)
  }
}

function needsGoLive(handler) {
  return (request, h) => {
    const state = getState(request)
    if (!state.about?.cdpService) {
      return h.redirect('/about-your-service')
    }
    if (!state.about.goLive) {
      return h.redirect('/about-your-service/go-live')
    }
    return handler(request, h, state)
  }
}

/**
 * Error summary links. A date with one part missing links to that part, as
 * the Design System's date input guidance says.
 */
function errorList(errors, parts = {}) {
  return Object.entries(errors).map(([field, text]) => {
    const [first] = parts[field] ?? []
    return {
      text,
      href: first && first !== 'day' ? `#${field}-${first}` : `#${field}`
    }
  })
}

function banner(request) {
  return request.yar.flash('banner').at(-1) ?? null
}

function flash(request, notice) {
  request.yar.flash('banner', notice)
}

/**
 * Reads a GOV.UK date input and checks it the way the Design System's date
 * input guidance says to, naming the part that is missing.
 */
function readDate(payload, prefix, names, errors, earliest, errorParts = {}) {
  const parts = { day: 'Day', month: 'Month', year: 'Year' }
  const values = Object.fromEntries(
    Object.entries(parts).map(([part, suffix]) => [
      part,
      (payload[`${prefix}${suffix}`] ?? '').trim()
    ])
  )
  const missing = Object.keys(parts).filter((part) => !values[part])
  errorParts[prefix] = Object.keys(parts)
  if (missing.length === 3) {
    errors[prefix] = names.enter
    return null
  }
  if (missing.length) {
    errorParts[prefix] = missing
    errors[prefix] = `${names.label} must include a ${missing.join(' and ')}`
    return null
  }
  const [day, month, year] = [values.day, values.month, values.year].map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !/^\d{4}$/.test(values.year) ||
    date.getUTCDate() !== day ||
    date.getUTCMonth() !== month - 1
  ) {
    errors[prefix] = `${names.label} must be a real date`
    return null
  }
  const iso = date.toISOString().slice(0, 10)
  if (iso < earliest.date) {
    errors[prefix] = `${names.label} must be ${earliest.words}`
    return null
  }
  return iso
}

function dateValues(payload, prefix, iso) {
  if (payload) {
    return {
      day: payload[`${prefix}Day`],
      month: payload[`${prefix}Month`],
      year: payload[`${prefix}Year`]
    }
  }
  const [year, month, day] = iso?.split('-').map(Number) ?? []
  return { day, month, year }
}

function readLink(payload, errors) {
  const link = (payload.link ?? '').trim()
  if (!link) {
    errors.link = 'Enter a link to the evidence'
  } else if (!/^https:\/\/\S+$/.test(link)) {
    errors.link = 'Enter a link that starts with https://'
  } else if (link.length > maxLinkLength) {
    errors.link = `Link must be ${maxLinkLength.toLocaleString('en-GB')} characters or fewer`
  }
  return link
}

function startPage(request, h) {
  const state = getState(request)
  return h.view(`${views}/start`, {
    pageTitle: 'Service Passport',
    hasPassport: Boolean(state.confirmed),
    service: findCdpService(state.about?.cdpService)
  })
}

function startAgain(request, h) {
  clearState(request)
  return h.redirect('/')
}

// About your service: which service, its go-live date, then what AI found

function serviceView(h, state, value, error) {
  return h.view(`${views}/about`, {
    pageTitle: 'Which service is the passport for?',
    cdpTeam: data.cdpTeam,
    cdpServices: data.cdpServices,
    value,
    error
  })
}

function showService(request, h) {
  const state = getState(request)
  if (state.confirmed) {
    return h.redirect('/about-your-service/check')
  }
  return serviceView(h, state, state.about?.cdpService)
}

function saveService(request, h) {
  const state = getState(request)
  if (state.confirmed) {
    return h.redirect('/about-your-service/check')
  }
  const service = findCdpService(request.payload?.cdpService)
  if (!service) {
    return serviceView(
      h,
      state,
      undefined,
      'Select the service the passport is for'
    )
  }
  const sameService = state.about?.cdpService === service.id
  setState(request, {
    ...state,
    about: { ...state.about, cdpService: service.id },
    answers: sameService ? state.answers : suggestedAnswers(service)
  })
  return h.redirect('/about-your-service/go-live')
}

function goLiveView(h, state, values, errors = {}, errorParts = {}) {
  return h.view(`${views}/go-live`, {
    pageTitle: 'When do you plan to go live?',
    service: findCdpService(state.about.cdpService),
    confirmed: state.confirmed,
    values,
    errors,
    errorParts,
    errorList: errorList(errors, errorParts)
  })
}

function showGoLive(request, h) {
  const state = getState(request)
  if (!state.about?.cdpService) {
    return h.redirect('/about-your-service')
  }
  return goLiveView(h, state, dateValues(null, 'goLive', state.about.goLive))
}

function saveGoLive(request, h) {
  const state = getState(request)
  if (!state.about?.cdpService) {
    return h.redirect('/about-your-service')
  }
  const payload = request.payload ?? {}
  const errors = {}
  const errorParts = {}
  const goLive = readDate(
    payload,
    'goLive',
    {
      enter: 'Enter your target go-live date',
      label: 'Target go-live date'
    },
    errors,
    { date: addDays(today(state), 1), words: 'in the future' },
    errorParts
  )
  if (!goLive) {
    return goLiveView(
      h,
      state,
      dateValues(payload, 'goLive'),
      errors,
      errorParts
    )
  }

  const next = {
    ...state,
    about: { ...state.about, goLive },
    answers:
      state.answers ?? suggestedAnswers(findCdpService(state.about.cdpService))
  }
  if (state.confirmed && goLive !== state.about.goLive) {
    next.routeLog = logRouteChange(
      state,
      `You moved your target go-live date from ${longDate(state.about.goLive)} to ${longDate(goLive)}.`
    )
    const route = buildRoute(next)
    const late = route.late.length
    flash(request, {
      type: late || route.impossible ? 'important' : 'success',
      heading: 'Your dates have moved',
      text: `Every date is now worked back from ${longDate(goLive)}.${late ? ` ${plural(late, 'step is', 'steps are')} overdue.` : ''}`
    })
  }
  setState(request, next)
  return h.redirect('/about-your-service/check')
}

function yesNo(value) {
  if (!value) {
    return 'Not answered'
  }
  return value === 'yes' ? 'Yes' : 'No'
}

function answerNote(question, state, service) {
  const unknown = service?.aiCouldNotFind?.includes(question.id)
  const answered = Boolean(state.answers[question.id])
  if (unknown) {
    return answered
      ? 'AI could not find this. You answered it.'
      : 'AI could not find this. Answer it yourself.'
  }
  if (state.answers[question.id] !== question.suggested) {
    return `AI suggested ${yesNo(question.suggested).toLowerCase()}. You changed it.`
  }
  return `Suggested by AI. ${question.reason}`
}

function sameSet(a, b) {
  return a.length === b.length && a.every((item) => b.includes(item))
}

function answerRows(state, service) {
  const rows = data.questions.map((question) => ({
    id: question.id,
    label: question.label,
    changeText: question.changeText,
    value: yesNo(state.answers[question.id]),
    answered: Boolean(state.answers[question.id]),
    note: answerNote(question, state, service)
  }))
  const done = state.answers.alreadyDone
    .map((stepId) => data.steps.find((step) => step.id === stepId)?.name)
    .filter(Boolean)
  rows.push({
    id: 'alreadyDone',
    label: data.alreadyDone.label,
    changeText: data.alreadyDone.changeText,
    value: done.length ? done.join('\n') : 'None',
    lines: done,
    answered: true,
    note: sameSet(state.answers.alreadyDone, data.alreadyDone.suggested)
      ? `Suggested by AI. ${data.alreadyDone.reason}`
      : 'You changed what AI suggested.'
  })
  return rows
}

function checkView(h, request, state, errors = []) {
  const service = findCdpService(state.about.cdpService)
  return h.view(`${views}/check`, {
    pageTitle: state.confirmed ? 'About your service' : 'Check your answers',
    state,
    service,
    rows: answerRows(state, service),
    errorList: errors,
    banner: banner(request)
  })
}

const showCheck = needsGoLive((request, h, state) =>
  checkView(h, request, state)
)

const confirmAnswers = needsGoLive((request, h, state) => {
  if (state.confirmed) {
    return h.redirect('/passport')
  }
  const unanswered = unansweredQuestions(state.answers)
  if (unanswered.length) {
    return checkView(
      h,
      request,
      state,
      unanswered.map((question) => ({
        text: question.error,
        href: `#change-${question.id}`
      }))
    )
  }
  const service = findCdpService(state.about.cdpService)
  const next = {
    ...state,
    confirmed: true,
    stamps: syncStamps({}, state.answers, service, today(state))
  }
  setState(request, next)
  flash(request, {
    type: 'success',
    heading: 'Your passport is set up',
    text: `Its ${buildRoute(next).steps.length} steps are dated back from go-live on ${longDate(state.about.goLive)}.`
  })
  return h.redirect('/passport')
})

function findQuestion(questionId) {
  if (questionId === 'alreadyDone') {
    return { id: 'alreadyDone', multiple: true, ...data.alreadyDone }
  }
  return data.questions.find((question) => question.id === questionId) ?? null
}

function doneOptions(state) {
  const onRoute = new Set(buildRoute(state).steps.map((step) => step.id))
  return data.steps
    .filter(
      (step) => step.dueBefore || step.id === 'technical-design-authority'
    )
    .filter((step) => onRoute.has(step.id))
    .map((step) => ({
      ...step,
      foundIn: data.alreadyDone.evidence[step.id]?.foundIn
    }))
}

function aiNoteFor(question, service) {
  if (question.multiple) {
    return null
  }
  if (service?.aiCouldNotFind?.includes(question.id)) {
    return 'AI could not find this in your repository or the CDP portal.'
  }
  return `AI suggested ${yesNo(question.suggested).toLowerCase()}. ${question.reason}`
}

function questionView(h, question, state, value, error) {
  const service = findCdpService(state.about.cdpService)
  return h.view(`${views}/question`, {
    pageTitle: question.question,
    question,
    value,
    error,
    aiNote: aiNoteFor(question, service),
    doneOptions: question.multiple ? doneOptions(state) : [],
    backHref: '/about-your-service/check'
  })
}

const showQuestion = needsGoLive((request, h, state) => {
  const question = findQuestion(request.params.questionId)
  if (!question) {
    return h.redirect('/about-your-service/check')
  }
  return questionView(h, question, state, state.answers[question.id])
})

/**
 * Every change the delivery lead makes to the route is kept on the
 * passport, so anyone it is shared with can see what changed and when.
 */
function logRouteChange(state, text, changes = []) {
  return [
    ...(state.routeLog ?? []),
    { ...historyEntry(today(state), text), changes }
  ]
}

/** What a changed step now needs, in the same words on every line. */
function changeDetail(step) {
  if (step.overdue) {
    return ` Overdue: it was ${step.overdue.due}.`
  }
  if (step.statusText === 'Evidence needed') {
    return ' Evidence needed.'
  }
  if (step.done) {
    return ''
  }
  return step.hint ? ` ${step.hint}.` : ''
}

function changeLine(step, old) {
  if (!old) {
    return `Added: ${step.name}.${changeDetail(step)}`
  }
  if (old.runBy !== step.runBy) {
    return `${step.name}: now run by the ${step.runBy}.${changeDetail(step)}`
  }
  if (old.done && !step.done && !step.stamp.before) {
    return `${step.name}: no longer marked as done.${changeDetail(step)}`
  }
  if (!old.stamp.before && step.stamp.before) {
    return step.done
      ? `${step.name}: marked as done before the passport.`
      : `${step.name}: evidence needed.`
  }
  if (old.statusText !== step.statusText || old.hint !== step.hint) {
    return `${step.name}: ${step.statusText.toLowerCase()}.${changeDetail(step)}`
  }
  return null
}

/** What one change of answers did to the route, step by step. */
function routeChanges(before, after) {
  const was = new Map(before.steps.map((step) => [step.id, step]))
  const now = new Map(after.steps.map((step) => [step.id, step]))
  const lines = after.steps
    .map((step) => changeLine(step, was.get(step.id)))
    .filter(Boolean)
  for (const step of before.steps) {
    if (!now.has(step.id)) {
      lines.push(`Removed: ${step.name}.`)
    }
  }
  return lines
}

const saveQuestion = needsGoLive((request, h, state) => {
  const question = findQuestion(request.params.questionId)
  if (!question) {
    return h.redirect('/about-your-service/check')
  }
  const payload = request.payload ?? {}
  let value
  if (question.multiple) {
    const ticked = [payload.alreadyDone ?? []].flat().filter(Boolean)
    if (!ticked.length) {
      return questionView(h, question, state, [], question.error)
    }
    value = ticked.includes('none') ? [] : ticked
  } else if (['yes', 'no'].includes(payload.answer)) {
    value = payload.answer
  } else {
    return questionView(h, question, state, undefined, question.error)
  }

  const answers = { ...state.answers, [question.id]: value }
  const next = { ...state, answers }
  if (state.confirmed) {
    const service = findCdpService(state.about.cdpService)
    next.stamps = syncStamps(state.stamps, answers, service, today(state))
    const lines = routeChanges(buildRoute(state), buildRoute(next))
    if (lines.length) {
      const answer = question.multiple
        ? ''
        : ` to ${yesNo(value).toLowerCase()}`
      next.routeLog = logRouteChange(
        state,
        `You changed "${question.label}"${answer}.`,
        lines
      )
      flash(request, {
        type: 'important',
        heading: 'Your route has changed',
        list: lines
      })
    }
  }
  setState(request, next)
  return h.redirect('/about-your-service/check')
})

// The plan, the passport and sharing

function planRows(route, goLive) {
  const rows = []
  for (const step of route.steps) {
    if (step.done || step.status === 'submitted') {
      continue
    }
    let date = null
    let text = step.todo
    if (step.status === 'booked') {
      date = step.stamp.bookedFor
      text = step.name
    } else if (step.boardDate && step.status === 'in-progress') {
      date = step.boardDate
      text = `${step.name} meets`
    } else if (step.plan) {
      date = step.plan.actionBy
    }
    if (step.blockingConditions.length) {
      for (const condition of step.blockingConditions) {
        rows.push({
          date: goLive,
          order: 0,
          before: true,
          sent: Boolean(condition.sentOn),
          text: condition.text,
          step
        })
      }
    } else if (date || step.flag === 'late') {
      rows.push({ date, order: 0, text, step })
    }
  }
  for (const condition of route.afterGoLive.filter((c) => !c.met)) {
    rows.push({
      date: condition.dueDate,
      order: 0,
      text: condition.text,
      step: condition.step,
      sent: Boolean(condition.sentOn),
      condition: true
    })
  }
  rows.push({ date: route.now, order: -1, milestone: 'Today' })
  rows.push({
    date: route.papers,
    order: 1,
    milestone: 'Stage gate 4 papers due'
  })
  rows.push({
    date: route.gate4,
    order: 1,
    milestone: 'Stage gate 4 board, latest date'
  })
  rows.push({ date: goLive, order: 1, milestone: 'Target go-live' })
  return rows.sort(
    (a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.order - b.order
  )
}

const showPlan = needsRoute((request, h, state) => {
  const route = buildRoute(state)
  return h.view(`${views}/route`, {
    pageTitle: 'Your plan to go-live',
    state,
    service: findCdpService(state.about.cdpService),
    route,
    rows: planRows(route, state.about.goLive)
  })
})

const showPassport = needsRoute((request, h, state) => {
  const route = buildRoute(state)
  return h.view(`${views}/passport`, {
    pageTitle: 'Your passport',
    state,
    service: findCdpService(state.about.cdpService),
    route,
    next: nextStep(route),
    banner: banner(request)
  })
})

const showShare = needsRoute((request, h, state) => {
  return h.view(`${views}/share`, {
    pageTitle: 'Share your passport',
    service: findCdpService(state.about.cdpService),
    link: `${request.url.origin}/passport`
  })
})

/** Moves the demo date on, so a demo can show time passing. */
const timePasses = needsRoute((request, h, state) => {
  const now = addDays(today(state), demoStepDays)
  const goLive = state.about.goLive
  setState(request, { ...state, now: now < goLive ? now : goLive })
  flash(request, {
    type: 'success',
    heading: `The demo date is now ${longDate(now < goLive ? now : goLive)}`
  })
  return h.redirect('/passport')
})

/**
 * Runs the rest of the route to plan: each open step is sent and approved
 * on the date it would be, and the demo date moves on to the last of them.
 * Steps that need evidence or a production deployment are left alone.
 */
const approveEverything = needsRoute((request, h, state) => {
  const route = buildRoute(state)
  const stamps = { ...state.stamps }
  let latest = route.now
  for (const step of route.steps) {
    if (step.decided || step.done || step.fromData || step.stamp.before) {
      continue
    }
    const { decidedOn, sentOn } = plannedDecision(
      step,
      route,
      state.about.goLive
    )
    const history = [...(step.stamp.history ?? [])]
    if (step.status !== 'submitted') {
      history.push(historyEntry(sentOn, `Sent to the ${step.waitingFor}.`))
    }
    history.push(
      historyEntry(
        decidedOn,
        `${step.outcomes?.approved ?? 'Approved'} by the ${step.waitingFor}. From their decision record.`
      )
    )
    stamps[step.id] = {
      ...step.stamp,
      status: 'approved',
      sentOn,
      decidedOn,
      history
    }
    latest = decidedOn > latest ? decidedOn : latest
  }
  setState(request, { ...state, stamps, now: latest })
  return h.redirect('/passport')
})

// One step

function stepOrRedirect(handler) {
  return needsRoute((request, h, state) => {
    const route = buildRoute(state)
    const step = findStep(route, request.params.stepId)
    if (!step || step.cannotStart) {
      return h.redirect('/passport')
    }
    return handler(request, h, state, step, route)
  })
}

function stepView(h, state, step, extra = {}) {
  return h.view(`${views}/step`, {
    pageTitle: step.name,
    state,
    step,
    stageName: data.stages.find((stage) => stage.id === step.stage).name,
    now: today(state),
    conversation: state.conversations?.[step.id] ?? [],
    maxQuestionLength,
    ...extra
  })
}

const showStep = stepOrRedirect((request, h, state, step) =>
  stepView(h, state, step, { banner: banner(request) })
)

const askAboutStep = stepOrRedirect((request, h, state, step) => {
  if (!step.source) {
    return h.redirect(step.href)
  }
  const question = (request.payload?.question ?? '').trim()
  let error = null
  if (!question) {
    error = 'Enter your question'
  } else if (question.length > maxQuestionLength) {
    error = `Question must be ${maxQuestionLength} characters or fewer`
  }
  if (error) {
    return stepView(h, state, step, { error, question })
  }
  const conversation = [
    ...(state.conversations?.[step.id] ?? []),
    { question, answer: answerQuestion(step, question) }
  ]
  setState(request, {
    ...state,
    conversations: { ...state.conversations, [step.id]: conversation }
  })
  return h.redirect(`/passport/${step.id}#answer-${conversation.length}`)
})

function statusOptions(step) {
  return step.options.filter(
    (option) => option.value !== 'submitted' || !step.sendBlockers.length
  )
}

function statusView(h, state, step, values, errors = {}, errorParts = {}) {
  return h.view(`${views}/status`, {
    pageTitle:
      step.statusQuestion ?? `Where is your ${step.sentenceName} up to?`,
    step,
    values,
    errors,
    errorParts,
    errorList: errorList(errors, errorParts),
    options: statusOptions(step)
  })
}

const showStatus = stepOrRedirect((request, h, state, step) => {
  if (!step.editable) {
    return h.redirect(step.href)
  }
  const current = statusOptions(step).some(
    (option) => option.value === step.status
  )
  return statusView(h, state, step, {
    status: current ? step.status : undefined,
    bookedFor: dateValues(null, 'bookedFor', step.stamp.bookedFor)
  })
})

function statusBanner(step, status, stamp, plan) {
  const option = step.options.find((item) => item.value === status)
  if (status === 'booked' && plan && stamp.bookedFor > plan.latestBooking) {
    return {
      type: 'important',
      heading: `Your ${step.sentenceName} on ${longDate(stamp.bookedFor)} is too late`,
      text: `Book a date on or before ${longDate(plan.latestBooking)}, or move your go-live date. That leaves time for the rest of the work before ${plan.milestoneNoun} on ${longDate(plan.milestone)}.`
    }
  }
  const headings = {
    booked: `${step.name} booked for ${longDate(stamp.bookedFor ?? '')}`,
    submitted: `${step.name} is waiting for a decision from the ${step.waitingFor}`
  }
  return {
    type: 'success',
    heading:
      headings[status] ?? `${step.name} marked as ${option.text.toLowerCase()}`
  }
}

function historyFor(step, status, stamp) {
  const option = step.options.find((item) => item.value === status)
  if (status === 'booked') {
    return `Booked for ${longDate(stamp.bookedFor)}. Recorded by you.`
  }
  if (status === 'submitted') {
    return `Sent to the ${step.waitingFor}. Recorded by you.`
  }
  return `Marked as ${option.text.toLowerCase()} by you.`
}

const saveStatus = stepOrRedirect((request, h, state, step) => {
  if (!step.editable) {
    return h.redirect(step.href)
  }
  const payload = request.payload ?? {}
  const status = payload.status
  const errors = {}
  const errorParts = {}
  if (!statusOptions(step).some((option) => option.value === status)) {
    errors.status = `Select where your ${step.sentenceName} is up to`
  }
  const now = today(state)
  let bookedFor = null
  if (status === 'booked') {
    bookedFor = readDate(
      payload,
      'bookedFor',
      {
        enter: `Enter the date of your ${step.sentenceName}`,
        label: `Date of your ${step.sentenceName}`
      },
      errors,
      { date: now, words: 'today or in the future' },
      errorParts
    )
  }
  if (Object.keys(errors).length) {
    return statusView(
      h,
      state,
      step,
      { status, bookedFor: dateValues(payload, 'bookedFor') },
      errors,
      errorParts
    )
  }

  const stamp = {
    status,
    ...(bookedFor && { bookedFor }),
    ...(status === 'submitted' && { sentOn: now }),
    ...(status === 'in-progress' && { startedOn: step.stamp.startedOn ?? now })
  }
  stamp.history = [
    ...(step.stamp.history ?? []),
    historyEntry(now, historyFor(step, status, stamp))
  ]
  setState(request, {
    ...state,
    stamps: { ...state.stamps, [step.id]: stamp }
  })
  flash(request, statusBanner(step, status, stamp, step.plan))
  return h.redirect('/passport')
})

function decisionWords(step, decision) {
  const outcome = step.outcomes
  const words = {
    approve: outcome
      ? `recorded your ${step.sentenceName} as met`
      : `approved your ${step.sentenceName}`,
    conditions: outcome
      ? `recorded your ${step.sentenceName} as met with conditions`
      : `approved your ${step.sentenceName} with conditions`,
    reject: outcome
      ? `recorded your ${step.sentenceName} as not met`
      : `did not approve your ${step.sentenceName}`
  }
  return `The ${step.waitingFor} ${words[decision]}`
}

function conditionDue(condition, goLive) {
  return condition.due === 'after-go-live'
    ? `by ${longDate(addDays(goLive, condition.days))}`
    : 'before go-live'
}

/**
 * Stands in for the team that decides, who is a different person and does
 * not use the passport. Lets a demo show approval, conditions or a step
 * sent back.
 */
const simulateDecision = stepOrRedirect((request, h, state, step) => {
  const decision = request.payload?.decision
  const statuses = {
    approve: 'approved',
    conditions: 'approved-with-conditions',
    reject: 'not-approved'
  }
  if (step.status !== 'submitted' || !statuses[decision]) {
    return h.redirect(step.href)
  }
  const now = today(state)
  const status = statuses[decision]
  const conditions =
    decision === 'conditions'
      ? step.possibleConditions.map((condition) => ({
          ...condition,
          met: false
        }))
      : []
  const outcome = step.outcomes?.[status] ?? outcomeWords[status]
  const stamp = {
    ...step.stamp,
    status,
    decidedOn: now,
    ...(decision === 'reject' && { reason: step.notApproved }),
    conditions,
    history: [
      ...(step.stamp.history ?? []),
      historyEntry(
        now,
        `${outcome} by the ${step.waitingFor}. From their decision record.${decision === 'reject' ? ` Reason: ${step.notApproved}` : ''}`
      )
    ]
  }
  setState(request, {
    ...state,
    stamps: { ...state.stamps, [step.id]: stamp }
  })
  const notice = {
    type: decision === 'reject' ? 'important' : 'success',
    heading: decisionWords(step, decision)
  }
  if (decision === 'reject') {
    notice.text = `Reason: ${step.notApproved}`
  }
  if (decision === 'conditions') {
    notice.list = conditions.map(
      (condition) =>
        `${condition.text}, ${conditionDue(condition, state.about.goLive)}.`
    )
  }
  flash(request, notice)
  return h.redirect('/passport')
})

/**
 * The decision record or evidence behind a step. In the real service this
 * opens the deciding team's own record; here it says what it would show.
 */
const showRecord = stepOrRedirect((request, h, state, step) => {
  const { stamp } = step
  if (!step.decided && !stamp.foundIn && !stamp.fromData) {
    return h.redirect(step.href)
  }
  let heading = 'Decision record'
  if (stamp.fromData) {
    heading = 'Production deployment'
  } else if (stamp.before) {
    heading = 'Evidence'
  }
  return h.view(`${views}/record`, {
    pageTitle: `${heading}: ${step.name}`,
    heading,
    step,
    goLive: state.about.goLive
  })
})

function evidenceView(h, step, values, errors = {}, errorParts = {}) {
  return h.view(`${views}/evidence`, {
    pageTitle: `Add evidence: ${step.name}`,
    step,
    values,
    errors,
    errorParts,
    errorList: errorList(errors, errorParts)
  })
}

const showEvidence = stepOrRedirect((request, h, state, step) => {
  if (!step.stamp.before || step.stamp.decidedOn) {
    return h.redirect(step.href)
  }
  return evidenceView(h, step, { decidedOn: {} })
})

const saveEvidence = stepOrRedirect((request, h, state, step) => {
  if (!step.stamp.before || step.stamp.decidedOn) {
    return h.redirect(step.href)
  }
  const payload = request.payload ?? {}
  const errors = {}
  const errorParts = {}
  const decidedOn = readDate(
    payload,
    'decidedOn',
    {
      enter: 'Enter the date of the decision',
      label: 'Date of the decision'
    },
    errors,
    { date: '2000-01-01', words: 'after 1 January 2000' },
    errorParts
  )
  if (decidedOn && decidedOn > today(state)) {
    errors.decidedOn = 'Date of the decision must be today or in the past'
  }
  const link = readLink(payload, errors)
  if (Object.keys(errors).length) {
    return evidenceView(
      h,
      step,
      { decidedOn: dateValues(payload, 'decidedOn'), link },
      errors,
      errorParts
    )
  }
  const now = today(state)
  setState(request, {
    ...state,
    stamps: {
      ...state.stamps,
      [step.id]: {
        ...step.stamp,
        decidedOn,
        evidenceUrl: link,
        history: [
          ...(step.stamp.history ?? []),
          historyEntry(now, 'Evidence link added by you.')
        ]
      }
    }
  })
  flash(request, {
    type: 'success',
    heading: `Evidence added for ${step.sentenceName}`
  })
  return h.redirect(step.href)
})

function conditionOrRedirect(handler) {
  return stepOrRedirect((request, h, state, step) => {
    const index = Number(request.params.index)
    const condition = step.conditions[index]
    if (!condition || condition.met) {
      return h.redirect(step.href)
    }
    return handler(request, h, state, step, condition, index)
  })
}

function updateCondition(state, step, index, changes, note) {
  const now = today(state)
  const conditions = step.stamp.conditions.map((item, position) =>
    position === index ? { ...item, ...changes(now) } : item
  )
  return {
    conditions,
    state: {
      ...state,
      stamps: {
        ...state.stamps,
        [step.id]: {
          ...step.stamp,
          conditions,
          history: [...(step.stamp.history ?? []), historyEntry(now, note)]
        }
      }
    }
  }
}

function conditionView(h, step, condition, values, errors = {}) {
  return h.view(`${views}/condition`, {
    pageTitle: condition.text,
    step,
    condition,
    due: conditionDue(condition, step.goLive),
    values,
    errors,
    errorList: errorList(errors)
  })
}

const showCondition = conditionOrRedirect(
  (request, h, state, step, condition) => {
    if (condition.sentOn) {
      return h.redirect(step.href)
    }
    return conditionView(
      h,
      { ...step, goLive: state.about.goLive },
      condition,
      {}
    )
  }
)

/**
 * The delivery lead sends evidence. Only the team that set the condition
 * can say it is met, so the condition stays open until they confirm.
 */
const saveCondition = conditionOrRedirect(
  (request, h, state, step, condition, index) => {
    if (condition.sentOn) {
      return h.redirect(step.href)
    }
    const errors = {}
    const link = readLink(request.payload ?? {}, errors)
    if (Object.keys(errors).length) {
      return conditionView(
        h,
        { ...step, goLive: state.about.goLive },
        condition,
        { link },
        errors
      )
    }
    const { state: next } = updateCondition(
      state,
      step,
      index,
      (now) => ({ sentOn: now, evidenceUrl: link }),
      `Evidence sent for "${condition.text}". Recorded by you.`
    )
    setState(request, next)
    flash(request, {
      type: 'success',
      heading: `Evidence sent to the ${step.waitingFor}`,
      text: `They will confirm whether "${condition.text}" is met.`
    })
    return h.redirect(step.href)
  }
)

/** Stands in for the team that set the condition confirming it is met. */
const confirmCondition = conditionOrRedirect(
  (request, h, state, step, condition, index) => {
    if (!condition.sentOn) {
      return h.redirect(step.href)
    }
    const { conditions, state: next } = updateCondition(
      state,
      step,
      index,
      (now) => ({ met: true, metOn: now }),
      `Condition met: "${condition.text}". Confirmed by the ${step.waitingFor}. From their decision record.`
    )
    setState(request, next)
    const stillOpen = conditions.filter(
      (item) => item.due === 'before-go-live' && !item.met
    ).length
    flash(request, {
      type: 'success',
      heading: `The ${step.waitingFor} confirmed a condition is met`,
      text: `${condition.text}.${stillOpen ? ` ${plural(stillOpen, 'condition is', 'conditions are')} still open on ${step.sentenceName}.` : ''}`
    })
    return h.redirect('/passport')
  }
)

/** The guidance an AI answer comes from, so people can check it. */
function showGuidance(request, h) {
  const step = data.steps.find(
    (item) => item.source?.slug === request.params.slug
  )
  if (!step) {
    return h.redirect('/')
  }
  return h.view(`${views}/guidance`, {
    pageTitle: step.source.text,
    step
  })
}

export {
  approveEverything,
  askAboutStep,
  confirmAnswers,
  confirmCondition,
  saveCondition,
  saveEvidence,
  saveGoLive,
  saveQuestion,
  saveService,
  saveStatus,
  showCheck,
  showCondition,
  showEvidence,
  showGoLive,
  showGuidance,
  showPassport,
  showPlan,
  showQuestion,
  showRecord,
  showService,
  showShare,
  showStatus,
  showStep,
  simulateDecision,
  startAgain,
  startPage,
  timePasses
}
