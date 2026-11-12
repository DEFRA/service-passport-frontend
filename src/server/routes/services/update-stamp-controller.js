import Boom from '@hapi/boom'
import Joi from 'joi'

import {
  buildPack,
  buildRoute
} from '#/server/common/helpers/passport/route-builder.js'
import {
  statusIds,
  statuses
} from '#/server/common/helpers/passport/statuses.js'
import { saveStamp } from '#/server/common/helpers/passport/store.js'
import { requireService, servicePageContext } from './service-page.js'

const kinds = ['step', 'pack']
const conditionsMaxLength = 500

const errorMessages = {
  status: 'Select what the gate owner decided',
  conditions: 'Enter the conditions'
}

/**
 * Finds the step or pack item being stamped.
 * @param {object} service
 * @param {import('@hapi/hapi').Request} request
 */
function findTarget(service, request) {
  const { kind, id } = request.params
  if (kind === 'pack') {
    const item = buildPack(service).items.find((entry) => entry.id === id)
    return item
      ? {
          name: item.name,
          status: item.status,
          entry: item.entry,
          backHref: item.href
        }
      : null
  }
  const journeyId = request.query.journey ?? null
  const step = buildRoute(service).steps.find(
    (entry) => entry.id === id && (entry.journey?.id ?? null) === journeyId
  )
  return step
    ? {
        name: step.journey ? `${step.name}: ${step.journey.name}` : step.name,
        status: step.status,
        entry: step.stamp,
        backHref: step.href,
        journeyId
      }
    : null
}

function viewModel(service, target, request, values, errors = {}) {
  const errorList = Object.entries(errors).map(([field, text]) => ({
    text,
    href: `#${field}`
  }))
  return {
    pageTitle: `${errorList.length ? 'Error: ' : ''}Update ${target.name}`,
    ...servicePageContext(service),
    target,
    backHref: target.backHref,
    action: request.path + (request.url.search ?? ''),
    statusItems: statuses.map((status) => ({
      value: status.id,
      text: status.text,
      checked: values.status === status.id,
      conditional:
        status.id === 'approved-with-conditions'
          ? { html: conditionsHtml(values.conditions, errors.conditions) }
          : undefined
    })),
    errors,
    errorList
  }
}

/**
 * The textarea revealed under "Approved with conditions". Built here so the
 * radios component can take it as conditional html.
 */
function conditionsHtml(value = '', error) {
  const errorHtml = error
    ? `<p id="conditions-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ${error}</p>`
    : ''
  const groupClass = error ? ' govuk-form-group--error' : ''
  const inputClass = error ? ' govuk-textarea--error' : ''
  const describedBy = error ? ' aria-describedby="conditions-error"' : ''
  return `<div class="govuk-form-group${groupClass}">
  <label class="govuk-label" for="conditions">What are the conditions?</label>
  ${errorHtml}
  <textarea class="govuk-textarea${inputClass}" id="conditions" name="conditions" rows="3"${describedBy}>${escapeHtml(value)}</textarea>
</div>`
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const paramsValidation = {
  params: Joi.object({
    serviceId: Joi.string().required(),
    kind: Joi.string()
      .valid(...kinds)
      .required(),
    id: Joi.string().required()
  }),
  failAction: () => {
    throw Boom.notFound()
  }
}

/**
 * Update a stamp: one question, what the gate owner decided.
 */
const updateStampController = {
  options: { validate: paramsValidation },
  handler(request, h) {
    const service = requireService(request)
    const target = findTarget(service, request)
    if (!target) {
      throw Boom.notFound()
    }
    return h.view(
      'services/update-stamp',
      viewModel(service, target, request, {
        status: target.status.id,
        conditions: target.entry?.conditions ?? ''
      })
    )
  }
}

const updateStampSubmitController = {
  options: {
    validate: {
      ...paramsValidation,
      payload: Joi.object({
        crumb: Joi.string().optional(),
        status: Joi.string()
          .valid(...statusIds)
          .optional(),
        conditions: Joi.string().allow('').max(conditionsMaxLength).optional()
      }),
      failAction: (_request, h) => h.continue
    }
  },
  handler(request, h) {
    const service = requireService(request)
    const target = findTarget(service, request)
    if (!target) {
      throw Boom.notFound()
    }
    const values = request.payload ?? {}
    const errors = {}
    if (!values.status) {
      errors.status = errorMessages.status
    }
    if (
      values.status === 'approved-with-conditions' &&
      !values.conditions?.trim()
    ) {
      errors.conditions = errorMessages.conditions
    }
    if (Object.keys(errors).length) {
      return h
        .view(
          'services/update-stamp',
          viewModel(service, target, request, values, errors)
        )
        .code(400)
    }

    saveStamp(service.id, {
      kind: request.params.kind,
      id: request.params.id,
      journey: target.journeyId ?? undefined,
      status: values.status,
      conditions: values.conditions?.trim()
    })
    return h.redirect(
      `${target.backHref}${target.backHref.includes('?') ? '&' : '?'}updated=true`
    )
  }
}

export { updateStampController, updateStampSubmitController }
