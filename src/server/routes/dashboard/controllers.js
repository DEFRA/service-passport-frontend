import { readFileSync } from 'node:fs'

export const data = JSON.parse(
  readFileSync(new URL('../../data/dashboard.json', import.meta.url), 'utf-8')
)

function stampFor(stepId, journeyId) {
  const stamp = data.stamps.find(
    (item) => item.stepId === stepId && item.journeyId === journeyId
  )
  const status = stamp?.status ?? 'To confirm'
  return {
    ...data.statuses.find((item) => item.text === status),
    toConfirm: stamp?.toConfirm ?? false
  }
}

export function dashboardModel({ view, journey }) {
  const selectedJourney = data.journeys.find((item) => item.id === journey)
  const steps = data.steps.map((step) => ({
    ...step,
    journeyNames: data.journeys
      .filter((item) => step.journeyIds?.includes(item.id))
      .map((item) => item.name)
      .join(', '),
    status: stampFor(step.id, step.scope === 'journey' ? journey : undefined)
  }))
  const nextGate = data.steps.find((step) => step.id === data.service.nextGate)
  const requiredStep = steps.find((step) => step.id === nextGate.requiredStepId)
  return {
    ...data,
    view,
    selectedJourney,
    steps,
    nextSteps: steps.filter(
      (step) =>
        step.scope === 'journey' &&
        (!step.journeyIds || step.journeyIds.includes(journey))
    ),
    wholeService: steps
      .filter((step) => step.wholeServiceOrder)
      .sort((a, b) => a.wholeServiceOrder - b.wholeServiceOrder),
    journeys: data.journeys.map((item) => ({
      ...item,
      platform: stampFor('platform-readiness', item.id),
      accessibility: stampFor('accessibility', item.id)
    })),
    counts: {
      total: data.stamps.length,
      approved: data.stamps.filter((stamp) =>
        ['Approved', 'Approved with conditions'].includes(stamp.status)
      ).length,
      inProgress: data.stamps.filter((stamp) => stamp.status === 'In progress')
        .length,
      notStarted: data.stamps.filter((stamp) => stamp.status === 'Not started')
        .length
    },
    inProgressNames: data.stamps
      .filter((stamp) => stamp.status === 'In progress')
      .map((stamp) => data.steps.find((step) => step.id === stamp.stepId).name)
      .join(', '),
    nextGate: {
      ...nextGate,
      note: `${requiredStep.name}: ${requiredStep.status.text}`
    },
    dashboardUrl: `/dashboard?view=${view}&journey=${journey}`
  }
}

export function showDashboard(request, h) {
  return h.view('dashboard/views/dashboard', {
    ...dashboardModel(request.query),
    pageTitle: 'Dashboard',
    backLink: { href: '/passport', text: 'Back' }
  })
}

export function showFullRoute(request, h) {
  const model = dashboardModel(request.query)
  return h.view('dashboard/views/route', {
    ...model,
    pageTitle: 'The full route',
    backLink: { href: model.dashboardUrl, text: 'Back' }
  })
}
