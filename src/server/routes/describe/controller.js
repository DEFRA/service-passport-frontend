import Boom from '@hapi/boom'
import { isValid, parseISO } from 'date-fns'

import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import {
  getService,
  saveService
} from '#/server/common/helpers/passport/store.js'
import { questions } from './questions.js'

const sessionKey = 'describe'
const maxNameLength = 100
const maxYear = 2100

function prefix(request) {
  return request.params.serviceId
    ? `/services/${request.params.serviceId}/describe`
    : '/describe'
}

function existingService(request) {
  if (!request.params.serviceId) {
    return null
  }
  const service = getService(request.params.serviceId)
  if (!service) {
    throw Boom.notFound()
  }
  return service
}

function questionsFor(service) {
  return questions.filter((question) => !service || !question.newServiceOnly)
}

/**
 * Answers so far: what is in the session, over what the service already has.
 */
function currentAnswers(request, service) {
  const fromService = service
    ? { name: service.name, goLive: service.goLive, ...service.tailoring }
    : {}
  return { ...fromService, ...(request.yar.get(sessionKey) ?? {}) }
}

function toFormValue(question, answers) {
  const value = answers[question.field]
  if (value === undefined || value === null) {
    return question.type === 'date' ? {} : ''
  }
  if (question.type === 'date') {
    const [year, month, day] = String(value).split('-')
    return { day: Number(day), month: Number(month), year }
  }
  return String(value)
}

function pad(value) {
  return String(value).padStart(2, '0')
}

/**
 * Reads one question's answer from the payload. Returns the stored value and
 * an error message if the answer is missing or not usable.
 * @param {object} question
 * @param {object} payload
 */
function readAnswer(question, payload = {}) {
  if (question.type === 'date') {
    const { day, month, year } = payload
    if (!day && !month && !year) {
      return { error: question.error }
    }
    const iso = `${year}-${pad(month)}-${pad(day)}`
    const date = parseISO(iso)
    if (!isValid(date) || Number(year) < 2000 || Number(year) > maxYear) {
      return { error: 'Go-live date must be a real date', value: payload }
    }
    return { value: iso }
  }
  const raw = String(payload[question.field] ?? '').trim()
  if (!raw) {
    return { error: question.error }
  }
  if (question.type === 'text') {
    return { value: raw.slice(0, maxNameLength) }
  }
  if (!question.options.some((option) => option.value === raw)) {
    return { error: question.error }
  }
  if (raw === 'true' || raw === 'false') {
    return { value: raw === 'true' }
  }
  return { value: raw }
}

function questionView(request, h, question, service, value, error) {
  const list = questionsFor(service)
  const index = list.indexOf(question)
  const backHref =
    index === 0
      ? service
        ? `/services/${service.id}`
        : '/'
      : `${prefix(request)}/${list[index - 1].id}`
  const changing = request.query.change === 'true'
  return h.view('describe/question', {
    pageTitle: `${error ? 'Error: ' : ''}${question.heading}`,
    question,
    value,
    error,
    backHref: changing ? `${prefix(request)}/check-answers` : backHref,
    action: `${prefix(request)}/${question.id}${changing ? '?change=true' : ''}`,
    service,
    items: (question.options ?? []).map((option) => ({
      ...option,
      hint: option.hint ? { text: option.hint } : undefined,
      checked: option.value === value
    }))
  })
}

const startController = {
  handler(request, h) {
    const service = existingService(request)
    request.yar.clear(sessionKey)
    const first = questionsFor(service)[0]
    return h.redirect(`${prefix(request)}/${first.id}`)
  }
}

const questionController = {
  handler(request, h) {
    const service = existingService(request)
    const question = questionsFor(service).find(
      (entry) => entry.id === request.params.questionId
    )
    if (!question) {
      throw Boom.notFound()
    }
    const answers = currentAnswers(request, service)
    return questionView(
      request,
      h,
      question,
      service,
      toFormValue(question, answers)
    )
  }
}

const questionSubmitController = {
  handler(request, h) {
    const service = existingService(request)
    const list = questionsFor(service)
    const index = list.findIndex(
      (entry) => entry.id === request.params.questionId
    )
    if (index === -1) {
      throw Boom.notFound()
    }
    const question = list[index]
    const { value, error } = readAnswer(question, request.payload)
    if (error) {
      const formValue =
        question.type === 'date'
          ? (value ?? {})
          : (request.payload?.[question.field] ?? '')
      return questionView(request, h, question, service, formValue, error).code(
        400
      )
    }
    request.yar.set(sessionKey, {
      ...(request.yar.get(sessionKey) ?? {}),
      [question.field]: value
    })
    const next = list[index + 1]
    const changing = request.query.change === 'true'
    if (!next || changing) {
      return h.redirect(`${prefix(request)}/check-answers`)
    }
    return h.redirect(`${prefix(request)}/${next.id}`)
  }
}

function answerText(question, answers) {
  const value = answers[question.field]
  if (value === undefined || value === null || value === '') {
    return ''
  }
  if (question.type === 'date') {
    return formatDate(value, 'd MMMM yyyy')
  }
  if (question.type === 'radios') {
    return (
      question.options.find((option) => option.value === String(value))?.text ??
      ''
    )
  }
  return String(value)
}

const checkAnswersController = {
  handler(request, h) {
    const service = existingService(request)
    const answers = currentAnswers(request, service)
    const list = questionsFor(service)
    const missing = list.find((question) => !answerText(question, answers))
    if (missing) {
      return h.redirect(`${prefix(request)}/${missing.id}`)
    }
    return h.view('describe/check-answers', {
      pageTitle: 'Check your answers',
      service,
      action: `${prefix(request)}/check-answers`,
      backHref: `${prefix(request)}/${list.at(-1).id}`,
      rows: list.map((question) => ({
        key: { text: question.heading },
        value: { text: answerText(question, answers) },
        actions: {
          items: [
            {
              href: `${prefix(request)}/${question.id}?change=true`,
              text: 'Change',
              visuallyHiddenText: question.heading.toLowerCase()
            }
          ]
        }
      }))
    })
  }
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const saveController = {
  handler(request, h) {
    const service = existingService(request)
    const answers = currentAnswers(request, service)
    const { name, goLive, ...tailoring } = answers
    const saved = saveService({
      id: service?.id ?? slugify(name),
      name: service?.name ?? name,
      description: service?.description ?? '',
      cdpService: service?.cdpService ?? slugify(name),
      phase: service?.phase ?? 'discovery',
      goLive,
      tailoring,
      journeys: service?.journeys ?? [],
      stamps: service?.stamps ?? [],
      pack: service?.pack ?? []
    })
    request.yar.clear(sessionKey)
    return h.redirect(`/services/${saved.id}?updated=true`)
  }
}

export {
  checkAnswersController,
  questionController,
  questionSubmitController,
  readAnswer,
  saveController,
  startController
}
