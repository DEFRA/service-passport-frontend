import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { format, parseISO } from 'date-fns'

/**
 * The passport for one example service, held in the visitor's session so
 * each person who opens the prototype gets their own copy and nobody else's
 * changes. Everything here is example data.
 */

const dirname = path.dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(
  readFileSync(path.resolve(dirname, '../../data/journey.json'), 'utf-8')
)

const sessionKey = 'passport'
const dayMs = 24 * 60 * 60 * 1000
const daysInWeek = 7
const soonDays = 21
const saturday = 6
const sunday = 0

const decidedStatuses = new Set([
  'approved',
  'approved-with-conditions',
  'not-approved'
])
const doneStatuses = new Set(['approved', 'approved-with-conditions', 'done'])

/**
 * How each status shows on the passport. A tag means the delivery lead has
 * something to do. Plain text means they are waiting, or it is finished.
 */
const statusLooks = {
  'not-started': { text: 'Not started', tag: 'govuk-tag--blue' },
  'in-progress': { text: 'In progress' },
  booked: { text: 'Booked' },
  submitted: { text: 'Waiting for a decision' },
  approved: { text: 'Approved' },
  'approved-with-conditions': { text: 'Approved with conditions' },
  'not-approved': { text: 'Not approved', tag: 'govuk-tag--red' },
  done: { text: 'Done' }
}

/** What the delivery lead can record, in the words that fit each step. */
const leadOptions = {
  book: [
    { value: 'not-started', text: 'Not booked yet' },
    { value: 'booked', text: 'Booked' },
    { value: 'submitted', text: 'Done, waiting for a decision' }
  ],
  work: [
    { value: 'not-started', text: 'Not started' },
    { value: 'in-progress', text: 'In progress' },
    { value: 'submitted', text: 'Sent for a decision' }
  ],
  raise: [
    { value: 'not-started', text: 'Not raised yet' },
    { value: 'submitted', text: 'Raised, waiting for a decision' }
  ]
}

/** Statuses the delivery lead can still change. Decisions are not theirs. */
const editableStatuses = new Set([
  'not-started',
  'in-progress',
  'booked',
  'not-approved'
])

function getState(request) {
  return request.yar.get(sessionKey) ?? { conversations: {} }
}

function setState(request, state) {
  request.yar.set(sessionKey, state)
  return state
}

/**
 * Starting again clears the whole session, the password included, so the
 * next research participant starts at the password page.
 */
function clearState(request) {
  request.yar.reset()
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

/**
 * The prototype runs on a fixed demo date, so the story reads the same on
 * any day. Prototype controls can move it forward.
 */
function today(state) {
  return state?.now ?? data.demoToday
}

function addDays(isoDate, days) {
  return toIsoDate(new Date(Date.parse(isoDate) + days * dayMs))
}

function longDate(isoDate) {
  return format(parseISO(isoDate), 'd MMMM yyyy')
}

function lastWorkingDay(isoDate) {
  const day = new Date(Date.parse(isoDate)).getUTCDay()
  if (day === saturday) {
    return addDays(isoDate, -1)
  }
  return day === sunday ? addDays(isoDate, -2) : isoDate
}

function spansChristmas(from, to) {
  const first = Number(from.slice(0, 4))
  const last = Number(to.slice(0, 4))
  for (let year = first; year <= last; year += 1) {
    const christmas = `${year}-12-25`
    if (christmas >= from && christmas <= to) {
      return true
    }
  }
  return false
}

function gate4Date(goLive) {
  return addDays(goLive, -data.gate4WeeksBeforeGoLive * daysInWeek)
}

/** Papers go to the Portfolio Office this long before the board meets. */
function papersDate(goLive) {
  const gate4 = data.steps.find((step) => step.id === 'gate-4')
  const weeks = gate4.timing.reduce((sum, part) => sum + part.weeks, 0)
  return addDays(gate4Date(goLive), -weeks * daysInWeek)
}

/**
 * The date each step's milestone falls on. Evidence for stage gate 4 has to
 * be decided before the papers go, not by the day the board meets.
 */
function milestoneFor(step, goLive) {
  if (step.neededBy === 'go-live') {
    return { date: goLive, name: 'go-live', noun: 'go-live' }
  }
  if (step.id === 'gate-4') {
    return {
      date: gate4Date(goLive),
      name: 'the stage gate 4 board meets',
      noun: 'the stage gate 4 board'
    }
  }
  return {
    date: papersDate(goLive),
    name: 'you send your stage gate 4 papers',
    noun: 'your stage gate 4 papers'
  }
}

function findCdpService(id) {
  return data.cdpServices.find((service) => service.id === id) ?? null
}

/** The answers AI suggests, read from the service's repository and CDP. */
function suggestedAnswers(service) {
  const unknown = new Set(service?.aiCouldNotFind ?? [])
  const answers = {}
  for (const question of data.questions) {
    answers[question.id] = unknown.has(question.id) ? null : question.suggested
  }
  answers.alreadyDone = [...data.alreadyDone.suggested]
  return answers
}

function unansweredQuestions(answers) {
  return data.questions.filter((question) => !answers[question.id])
}

function stepApplies(step, answers) {
  if (!step.when) {
    return true
  }
  return Object.entries(step.when).every(
    ([questionId, value]) => answers[questionId] === value
  )
}

/** Who runs the IT health check changes its notice period. */
function tailorStep(step, answers) {
  if (step.runByWithoutSupplier && answers.supplierPenTest === 'no') {
    return {
      ...step,
      runBy: step.runByWithoutSupplier,
      timing: step.timingWithoutSupplier
    }
  }
  return step
}

function steps(answers) {
  return data.steps
    .filter((step) => stepApplies(step, answers))
    .map((step) => tailorStep(step, answers))
}

/**
 * When to act on a step, worked back from the milestone it feeds: each part
 * of the wait in turn, 2 more weeks if the work runs over Christmas, then
 * back to a working day.
 */
function planFor(step, goLive) {
  if (!goLive || !step.timing) {
    return null
  }
  const { date: milestone, name, noun } = milestoneFor(step, goLive)
  const weeks = step.timing.reduce((sum, part) => sum + part.weeks, 0)
  let date = addDays(milestone, -weeks * daysInWeek)
  const christmas = spansChristmas(date, milestone)
  if (christmas) {
    date = addDays(date, -data.christmasWeeks * daysInWeek)
  }
  const [notice] = step.timing
  return {
    actionBy: lastWorkingDay(date),
    milestone,
    milestoneName: name,
    milestoneNoun: noun,
    weeks,
    totalWeeks: weeks + (christmas ? data.christmasWeeks : 0),
    christmas,
    parts: step.timing,
    latestBooking: addDays(milestone, -(weeks - notice.weeks) * daysInWeek)
  }
}

function historyEntry(on, text) {
  return { on, text }
}

/**
 * A decision made before the passport existed. AI found the evidence, or
 * the delivery lead ticked it and still has to link to the evidence.
 */
function doneBeforeStamp(step, now) {
  const found = data.alreadyDone.evidence[step.id]
  if (!found) {
    return {
      status: 'done',
      before: true,
      history: [
        historyEntry(now, 'Recorded by you as done before the passport.')
      ]
    }
  }
  return {
    status: 'done',
    before: true,
    decidedOn: found.decidedOn,
    foundIn: found.foundIn,
    history: [
      historyEntry(found.decidedOn, `Decided by the ${step.decidedBy}.`),
      historyEntry(now, `AI found this in ${found.foundIn}. Confirmed by you.`)
    ]
  }
}

/**
 * The stamps a new passport starts with: what was done before it, what CDP
 * data shows, and work the example service already has under way.
 */
function startingStamps(answers, service, now) {
  const stamps = {}
  for (const step of steps(answers)) {
    if (answers.alreadyDone.includes(step.id)) {
      stamps[step.id] = doneBeforeStamp(step, now)
    } else if (step.startStatus) {
      stamps[step.id] = {
        status: step.startStatus,
        startedOn: step.startedOn,
        history: [historyEntry(step.startedOn, 'Started.')]
      }
    }
  }
  return stamps
}

/**
 * Brings the stamps in line with new answers. A decision the delivery lead
 * no longer says was done before goes, so nothing stays approved by mistake.
 */
function syncStamps(stamps, answers, service, now) {
  const next = { ...stamps }
  for (const [stepId, stamp] of Object.entries(next)) {
    if (stamp.before && !answers.alreadyDone.includes(stepId)) {
      delete next[stepId]
    }
  }
  for (const [stepId, stamp] of Object.entries(
    startingStamps(answers, service, now)
  )) {
    if (!next[stepId] || (stamp.before && !next[stepId].before)) {
      next[stepId] = stamp
    }
  }
  return next
}

function isLate(step, status, plan, now) {
  if (step.dueBefore) {
    return status === 'not-started'
  }
  return Boolean(plan && plan.actionBy < now)
}

/**
 * Whether a step needs the delivery lead: overdue, due soon, booked for a
 * date that is too late, or a booked or board date that has passed with no
 * update.
 */
function stepFlag(step, stamp, plan, now) {
  const { status } = stamp
  if (status === 'booked') {
    if (stamp.bookedFor < now) {
      return 'update'
    }
    return plan && stamp.bookedFor > plan.latestBooking ? 'too-late' : null
  }
  if (status === 'in-progress' && step.boardDate && step.boardDate < now) {
    return 'update'
  }
  if (!['not-started', 'not-approved', 'in-progress'].includes(status)) {
    return null
  }
  if (isLate(step, status, plan, now)) {
    return 'late'
  }
  return plan && plan.actionBy <= addDays(now, soonDays) ? 'soon' : null
}

/**
 * A step's name as it reads mid-sentence. Names that are ordinary words
 * ("Accessibility audit") lose their capital; names of bodies and reviews
 * ("Platform Readiness Review") and acronyms ("IT health check") keep it.
 */
function nameInSentence(name) {
  const [first, second] = name.split(' ')
  const isAcronym = first.length > 1 && first === first.toUpperCase()
  const isTitle = second && /^[A-Z]/.test(second)
  return isAcronym || isTitle
    ? name
    : name.charAt(0).toLowerCase() + name.slice(1)
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** A label that starts a row, so "the data protection team" loses "the". */
function label(text) {
  return capitalise(text.replace(/^the /, ''))
}

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`
}

function describeConditions(stamp, goLive) {
  return (stamp.conditions ?? []).map((condition) => ({
    ...condition,
    dueDate:
      condition.due === 'after-go-live' && goLive
        ? addDays(goLive, condition.days)
        : null
  }))
}

function needsEvidence(stamp) {
  return Boolean(stamp.before && !stamp.decidedOn)
}

function outcomeText(step, status) {
  return step.outcomes?.[status] ?? statusLooks[status].text
}

/** The status text, and a tag only when the delivery lead has to act. */
function lookFor(step) {
  const flagLooks = {
    'too-late': { text: 'Booked too late', tag: 'govuk-tag--red' },
    update: { text: 'Update needed', tag: 'govuk-tag--blue' }
  }
  if (step.cannotStart) {
    return { text: 'Cannot start yet', tag: null }
  }
  if (needsEvidence(step.stamp)) {
    return { text: 'Evidence needed', tag: 'govuk-tag--blue' }
  }
  if (flagLooks[step.flag]) {
    return flagLooks[step.flag]
  }
  if (step.status === 'not-started' && step.flag === 'late') {
    return { text: 'Overdue', tag: 'govuk-tag--red' }
  }
  if (step.blockingConditions.length) {
    return step.blockingConditions.every((condition) => condition.sentOn)
      ? { text: 'Evidence sent', tag: null }
      : { text: 'Conditions open', tag: 'govuk-tag--yellow' }
  }
  if (
    step.status === 'approved-with-conditions' &&
    step.conditions.every((condition) => condition.met)
  ) {
    return {
      text: `${outcomeText(step, 'approved')}, conditions met`,
      tag: null
    }
  }
  return {
    text: outcomeText(step, step.status),
    tag: statusLooks[step.status].tag ?? null
  }
}

const againWords = { book: 'Book', work: 'Send it', raise: 'Raise it' }

function conditionsHint(step) {
  const open = step.blockingConditions
  const waiting = open.filter((condition) => condition.sentOn).length
  if (waiting === open.length) {
    return `${plural(waiting, 'condition', 'conditions')} waiting for the ${step.waitingFor} to confirm`
  }
  return `${plural(open.length, 'condition', 'conditions')} to meet before go-live`
}

function bookedHint(step) {
  const booked = `Booked for ${longDate(step.stamp.bookedFor)}`
  if (step.flag === 'too-late') {
    return `${booked}. Too late for ${step.plan.milestoneNoun} on ${longDate(step.plan.milestone)}`
  }
  return step.flag === 'update'
    ? `${booked}. Update where this is up to`
    : booked
}

function notApprovedHint(step) {
  const again = againWords[step.kind] ?? 'Try'
  if (!step.plan) {
    return `${step.statusText}. ${again} again`
  }
  return step.flag === 'late'
    ? `${step.statusText}. ${again} again now. It was due by ${longDate(step.plan.actionBy)}`
    : `${step.statusText}. ${again} again by ${longDate(step.plan.actionBy)}`
}

/** One fact under each step, always about where it is up to and when. */
function hintFor(step, service) {
  const { stamp } = step
  if (step.cannotStart) {
    return `After ${step.blockers.map((name) => nameInSentence(name)).join(' and ')}`
  }
  if (stamp.before) {
    return stamp.decidedOn
      ? `Decided ${longDate(stamp.decidedOn)}`
      : 'Add the evidence of the decision'
  }
  switch (step.status) {
    case 'not-approved':
      return notApprovedHint(step)
    case 'booked':
      return bookedHint(step)
    case 'submitted':
      return `Sent ${longDate(stamp.sentOn)}`
    case 'approved':
    case 'approved-with-conditions':
      return step.blockingConditions.length
        ? conditionsHint(step)
        : `Decided ${longDate(stamp.decidedOn)}`
    default:
      break
  }
  if (step.boardDate) {
    return step.flag === 'update'
      ? `Board was due ${longDate(step.boardDate)}. Update where this is up to`
      : `Board meets ${longDate(step.boardDate)}`
  }
  if (step.dueBefore) {
    return `Due before ${step.dueBefore}`
  }
  if (step.plan) {
    return step.flag === 'late'
      ? `Was due by ${longDate(step.plan.actionBy)}`
      : `${step.actionBy} ${longDate(step.plan.actionBy)}`
  }
  return null
}

/** Whether the service is in production, read from the CDP portal. */
function productionCheck(service) {
  const production = service?.production
  return production
    ? {
        text: 'Deployed to production',
        result: 'ready',
        found: `Version ${production.version} since ${longDate(production.on)}, in the CDP portal.`
      }
    : {
        text: 'Deployed to production',
        result: 'gap',
        found: 'Not in production yet.',
        fix: 'Deploy before your review.'
      }
}

/**
 * What AI found when the delivery lead asked it to check the service was
 * ready for this step, or null if the step has no checks. Nothing shows
 * until they ask, so the check is something they choose to run.
 */
function readinessFor(step, state) {
  if (!step.readiness) {
    return null
  }
  const items = step.checksProduction
    ? [
        productionCheck(findCdpService(state.about?.cdpService)),
        ...step.readiness
      ]
    : step.readiness
  const count = (result) =>
    items.filter((item) => item.result === result).length
  return {
    checkedOn: state.readiness?.[step.id] ?? null,
    items,
    gaps: count('gap'),
    unknown: count('unknown')
  }
}

/** Adds the things left to fix to a step's hint, once AI has checked. */
function withGaps(hint, step) {
  const readiness = step.readinessCheck
  const waiting = ['not-started', 'not-approved', 'booked'].includes(
    step.status
  )
  if (!hint || !readiness?.checkedOn || !readiness.gaps || !waiting) {
    return hint
  }
  return `${hint}. ${plural(readiness.gaps, 'thing', 'things')} to fix first`
}

function describeStep(step, state, now) {
  const stamp = state.stamps?.[step.id] ?? { status: 'not-started' }
  const goLive = state.about?.goLive
  const plan = planFor(step, goLive)
  const conditions = describeConditions(stamp, goLive)
  const blockingConditions = conditions.filter(
    (condition) => condition.due === 'before-go-live' && !condition.met
  )
  return {
    ...step,
    action: step.action ?? 'Book',
    actionBy: step.actionBy ?? 'Book by',
    sentenceName: nameInSentence(step.name),
    decidedByLabel: step.decidedBy ? label(step.decidedBy) : null,
    runByLabel: step.runBy ? label(step.runBy) : null,
    contactLabel: step.contact ? label(step.contact) : null,
    waitingFor: step.decidedByShort ?? step.decidedBy,
    stamp,
    status: stamp.status,
    possibleConditions: step.conditions ?? [],
    conditions,
    blockingConditions,
    done:
      doneStatuses.has(stamp.status) &&
      !blockingConditions.length &&
      !needsEvidence(stamp),
    decided: decidedStatuses.has(stamp.status),
    plan,
    flag: stepFlag(step, stamp, plan, now),
    readinessCheck: readinessFor(step, state),
    href: `/passport/${step.id}`
  }
}

/** Steps another step waits for. Gate 4 waits for everything before it. */
function blockersFor(step, described) {
  if (step.startsAfter) {
    return described.filter(
      (other) => step.startsAfter.includes(other.id) && !other.done
    )
  }
  return []
}

function sendBlockersFor(step, described) {
  if (step.sendAfter !== 'all') {
    return []
  }
  const approved = new Set(['approved', 'approved-with-conditions'])
  return described.filter(
    (other) =>
      other.id !== step.id &&
      !other.startsAfter?.includes(step.id) &&
      !other.done &&
      !approved.has(other.status)
  )
}

function finishStep(step, described, service) {
  const blockers = blockersFor(step, described).map((other) => other.name)
  const cannotStart = Boolean(blockers.length) && step.status === 'not-started'
  const sendBlockers = sendBlockersFor(step, described)
  const finished = {
    ...step,
    blockers,
    cannotStart,
    sendBlockers,
    flag: cannotStart ? null : step.flag
  }
  const look = lookFor(finished)
  const editable =
    !step.stamp.before && !cannotStart && editableStatuses.has(step.status)
  const withLook = { ...finished, statusText: look.text, tag: look.tag }
  return {
    ...withLook,
    hint: withGaps(hintFor(withLook, service), withLook),
    overdue: overdueWords(withLook),
    editable,
    options: leadOptions[step.kind] ?? []
  }
}

/** How the overdue warning names a late step and when it was due. */
function overdueWords(step) {
  if (step.flag !== 'late') {
    return null
  }
  if (step.dueBefore) {
    return { todo: step.todo, due: `due before ${step.dueBefore}` }
  }
  const date = longDate(step.plan.actionBy)
  return step.status === 'in-progress'
    ? {
        todo: `Finish your ${step.sentenceName}`,
        due: `due to start by ${date}`
      }
    : { todo: step.todo, due: `due by ${date}` }
}

/** A stage's heading names only what is in it for this service. */
function stageName(stage, stageSteps) {
  const fitting = (stage.namesIf ?? []).find((option) =>
    stageSteps.some((step) => step.id === option.step)
  )
  return fitting?.name ?? stage.name
}

function afterGoLive(routeSteps) {
  return routeSteps
    .flatMap((step) =>
      step.conditions
        .map((condition, index) => ({ ...condition, index, step }))
        .filter((condition) => condition.due === 'after-go-live')
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

/**
 * The route for this service: its stages in order, each with the steps the
 * answers say it needs, and where each step is.
 */
function buildRoute(state) {
  const now = today(state)
  const service = findCdpService(state.about?.cdpService)
  const answers = state.answers ?? suggestedAnswers(service)
  const described = steps(answers).map((step) => describeStep(step, state, now))
  const routeSteps = described.map((step) =>
    finishStep(step, described, service)
  )
  const stages = data.stages
    .map((stage) => {
      const stageSteps = routeSteps.filter((step) => step.stage === stage.id)
      return { ...stage, name: stageName(stage, stageSteps), steps: stageSteps }
    })
    .filter((stage) => stage.steps.length)

  const dueOn = (step) => step.plan?.actionBy ?? ''
  const byDate = (a, b) => dueOn(a).localeCompare(dueOn(b))
  const late = routeSteps.filter((step) => step.flag === 'late').sort(byDate)
  const soon = routeSteps.filter((step) => step.flag === 'soon').sort(byDate)
  const goLive = state.about?.goLive
  const gate4 = goLive ? gate4Date(goLive) : null
  const gate4Step = routeSteps.find((step) => step.id === 'gate-4')

  return {
    now,
    nextFortnight: addDays(now, 2 * daysInWeek),
    stages,
    steps: routeSteps,
    stepsLeft: routeSteps.filter((step) => !step.done).length,
    late,
    soon,
    tooLate: routeSteps.filter((step) => step.flag === 'too-late'),
    afterGoLive: afterGoLive(routeSteps),
    gate4,
    papers: goLive ? papersDate(goLive) : null,
    impossible: Boolean(gate4 && gate4 < now && !gate4Step?.done),
    ready: routeSteps.every((step) => step.done)
  }
}

/**
 * When a step's decision would come if everything ran to plan: the board's
 * own date, before the stage gate 4 papers go, at the board, or the working
 * day before go-live. Never earlier than today.
 */
function plannedDecision(step, route, goLive) {
  let decidedOn = route.now
  if (step.id === 'gate-4') {
    decidedOn = route.gate4
  } else if (step.neededBy === 'go-live') {
    decidedOn = lastWorkingDay(addDays(goLive, -1))
  } else if (step.boardDate) {
    decidedOn = step.boardDate
  } else if (step.neededBy === 'gate-4') {
    decidedOn = lastWorkingDay(addDays(route.papers, -1))
  }
  decidedOn = decidedOn > route.now ? decidedOn : route.now
  const sentOn =
    step.stamp.sentOn ??
    (step.id === 'gate-4' ? route.papers : null) ??
    step.stamp.bookedFor ??
    addDays(decidedOn, -daysInWeek)
  return { decidedOn, sentOn: sentOn < decidedOn ? sentOn : decidedOn }
}

/** The next thing to act on that is not already overdue or waiting. */
function nextStep(route) {
  const open = route.steps
    .filter((step) => step.editable && step.plan && step.flag !== 'late')
    .filter((step) => !step.sendBlockers.length)
    .filter((step) =>
      ['not-started', 'not-approved', 'in-progress'].includes(step.status)
    )
    .sort((a, b) => a.plan.actionBy.localeCompare(b.plan.actionBy))
  return open[0] ?? null
}

function findStep(route, stepId) {
  return route.steps.find((step) => step.id === stepId) ?? null
}

function normalise(question) {
  return question
    .trim()
    .toLowerCase()
    .replace(/[?.!\s]+$/, '')
}

const minKeywordHits = 3

/**
 * The answer to a question about one step, from that step's guidance. It
 * answers only when the question matches an example, or hits at least three
 * of an answer's words with one that no other answer uses. A stray question
 * gets "not found" rather than a confident answer to something else.
 */
function answerQuestion(step, question) {
  const asked = normalise(question)
  const words = asked.match(/[a-z0-9-]+/g) ?? []
  const answers = step.answers ?? []
  let best = answers.find(
    (answer) => answer.example && normalise(answer.example) === asked
  )
  if (!best) {
    let bestScore = minKeywordHits - 1
    for (const answer of answers) {
      const hits = answer.keywords.filter((keyword) => words.includes(keyword))
      const unique = hits.some(
        (keyword) =>
          !answers.some(
            (other) => other !== answer && other.keywords.includes(keyword)
          )
      )
      if (unique && hits.length > bestScore) {
        best = answer
        bestScore = hits.length
      }
    }
  }
  if (!best) {
    const contact = step.contact ?? `the ${step.decidedBy}`
    return {
      found: false,
      paragraphs: [
        `AI could not find an answer to that in the ${step.source.text}. Ask ${contact}.`
      ]
    }
  }
  return {
    found: true,
    source: step.source,
    paragraphs: best.paragraphs,
    bullets: best.bullets
  }
}

const passportSource = { text: 'your passport', href: '/passport' }

function wordsIn(question) {
  return normalise(question).match(/[a-z0-9-]+/g) ?? []
}

/** The step a question names, matched on the step's own name. */
function namedStep(route, asked) {
  return (
    route.steps.find((step) => asked.includes(step.name.toLowerCase())) ?? null
  )
}

/**
 * Why a step is on the route, from the rule that put it there, so AI never
 * restates the rule in its own words.
 */
function whyOnRoute(step) {
  const rule = data.steps.find((s) => s.id === step.id)?.when
  if (!rule) {
    return [`Every route has the ${step.sentenceName}, whatever your answers.`]
  }
  const labels = Object.keys(rule).map(
    (id) => data.questions.find((question) => question.id === id).question
  )
  return [
    `It is on your route because you answered yes to "${labels.join('" and "')}".`,
    'If that is wrong, change it in About your service.'
  ]
}

/** Answers about the person's own route, worked out from the passport. */
function routeAnswer(route, question) {
  const asked = normalise(question)
  const words = wordsIn(question)
  const step = namedStep(route, asked)
  if (
    step &&
    words.some((w) => ['skip', 'need', 'why', 'remove'].includes(w))
  ) {
    return { paragraphs: whyOnRoute(step) }
  }
  if (words.includes('overdue') || words.includes('late')) {
    return route.late.length
      ? {
          paragraphs: [
            `${plural(route.late.length, 'step is', 'steps are')} overdue:`
          ],
          bullets: route.late.map((late) => `${late.name}, ${late.overdue.due}`)
        }
      : { paragraphs: ['Nothing is overdue.'] }
  }
  if (words.includes('next')) {
    const next = nextStep(route)
    return {
      paragraphs: [
        next
          ? `${next.todo} by ${longDate(next.plan.actionBy)}.`
          : 'Nothing to book. Every open step is booked or waiting for a decision.'
      ]
    }
  }
  if (words.some((w) => ['left', 'remaining', 'open'].includes(w))) {
    const open = route.steps.filter((s) => !s.done)
    return {
      paragraphs: [
        `${plural(open.length, 'step is', 'steps are')} still open:`
      ],
      bullets: open.map((s) => `${s.name}: ${s.statusText.toLowerCase()}`)
    }
  }
  return null
}

/**
 * The answer to a question about the whole passport. Questions about the
 * route are answered from the passport's own rules and dates. Anything else
 * is answered from the guidance for a step: the step being asked about
 * first, then any step on the route. If nothing matches, it says so.
 */
function answerAboutPassport(route, question, focus) {
  const fromRoute = routeAnswer(route, question)
  if (fromRoute) {
    return { found: true, source: passportSource, ...fromRoute }
  }
  const asked = normalise(question)
  const guided = route.steps.filter((step) => step.source)
  const candidates = [focus, namedStep(route, asked), ...guided].filter(
    (step, index, all) => step?.source && all.indexOf(step) === index
  )
  for (const step of candidates) {
    const answer = answerQuestion(step, question)
    if (answer.found) {
      return answer
    }
  }
  const contact = focus
    ? (focus.contact ?? `the ${focus.decidedBy}`)
    : 'your service transition manager'
  return {
    found: false,
    paragraphs: [
      `AI could not find an answer in your passport or its guidance. Ask ${contact}.`
    ]
  }
}

export {
  addDays,
  answerAboutPassport,
  answerQuestion,
  buildRoute,
  capitalise,
  clearState,
  data,
  findCdpService,
  findStep,
  gate4Date,
  getState,
  historyEntry,
  longDate,
  nameInSentence,
  nextStep,
  plannedDecision,
  plural,
  setState,
  startingStamps,
  suggestedAnswers,
  syncStamps,
  today,
  unansweredQuestions
}
