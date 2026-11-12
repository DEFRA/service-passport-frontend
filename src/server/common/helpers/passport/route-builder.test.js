import {
  buildPack,
  buildRoute,
  lastGatePassed,
  programmeStatus,
  stepApplies
} from './route-builder.js'
import { getService, resetStore } from './store.js'

const today = new Date('2026-11-12')

function service(overrides = {}) {
  return {
    id: 'example',
    name: 'Example',
    phase: 'alpha',
    goLive: '2027-06-01',
    tailoring: {
      approach: 'agile',
      suppliers: false,
      usesAi: false,
      platform: 'cdp',
      size: 'small'
    },
    journeys: [],
    stamps: [],
    pack: [],
    ...overrides
  }
}

describe('#stepApplies', () => {
  test('applies a step with no rule to any service', () => {
    expect(stepApplies({ id: 'x' }, {})).toBe(true)
  })

  test('applies a rule only when every answer matches', () => {
    const step = { appliesWhen: { usesAi: true } }
    expect(stepApplies(step, { usesAi: true })).toBe(true)
    expect(stepApplies(step, { usesAi: false })).toBe(false)
  })
})

describe('#buildRoute', () => {
  afterEach(() => resetStore())

  test('leaves out service assessments for waterfall', () => {
    const route = buildRoute(
      service({ tailoring: { approach: 'waterfall' } }),
      today
    )
    const ids = route.steps.map((step) => step.id)
    expect(ids).not.toContain('alpha-assessment')
    expect(route.phases[0].name).toBe('Startup and feasibility')
  })

  test('adds the AI, Azure and supplier steps when the answers call for them', () => {
    const route = buildRoute(
      service({
        tailoring: {
          approach: 'agile',
          suppliers: true,
          usesAi: true,
          platform: 'azure'
        }
      }),
      today
    )
    const ids = route.steps.map((step) => step.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'algorithmic-transparency',
        'cloud-onboarding',
        'design-review-board',
        'gate-2',
        'alpha-assessment'
      ])
    )
  })

  test('gives journey-scoped steps one instance per journey', () => {
    const route = buildRoute(
      service({
        journeys: [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' }
        ],
        stamps: [{ step: 'pen-test', journey: 'b', status: 'booked' }]
      }),
      today
    )
    const penTests = route.steps.filter((step) => step.id === 'pen-test')
    expect(penTests.map((step) => step.journey.id)).toEqual(['a', 'b'])
    expect(penTests[0].status.id).toBe('not-started')
    expect(penTests[1].status.id).toBe('booked')
    expect(penTests[1].href).toBe('/services/example/steps/pen-test?journey=b')
  })

  test('flags a long wait as at risk when go-live is sooner than the wait', () => {
    const route = buildRoute(service({ goLive: '2026-12-01' }), today)
    const audit = route.steps.find((step) => step.id === 'accessibility-audit')
    expect(audit.atRisk).toBe(true)
    expect(route.atRisk).toBe(true)
    expect(route.next.id).toBe('service-design-approval')
  })

  test('does not flag a step that is booked or in progress', () => {
    const route = buildRoute(
      service({
        goLive: '2026-12-01',
        stamps: [
          { step: 'accessibility-audit', status: 'booked' },
          { step: 'service-design-approval', status: 'in-progress' }
        ]
      }),
      today
    )
    const byId = Object.fromEntries(route.steps.map((s) => [s.id, s]))
    expect(byId['accessibility-audit'].atRisk).toBe(false)
    expect(byId['service-design-approval'].needsBooking).toBe(false)
  })

  test('counts done steps and marks a phase done when all its steps are', () => {
    const route = buildRoute(getService('woodland-grant-checks'), today)
    expect(route.phases[0].done).toBe(true)
    expect(route.doneCount).toBe(route.totalCount - route.remaining.length)
    expect(route.isLive).toBe(true)
  })
})

describe('#programmeStatus and #lastGatePassed', () => {
  test('reports live, at risk and on track', () => {
    expect(programmeStatus({ isLive: true, atRisk: true }).text).toBe('Live')
    expect(programmeStatus({ isLive: false, atRisk: true }).text).toBe(
      'At risk'
    )
    expect(programmeStatus({ isLive: false, atRisk: false }).text).toBe(
      'On track'
    )
  })

  test('names the last gate passed', () => {
    const route = buildRoute(getService('plant-export-checks'), today)
    expect(lastGatePassed(route)).toBe('Gate 3 passed')
    expect(lastGatePassed({ steps: [] })).toBe('Before gate 1')
  })
})

describe('#buildPack', () => {
  test('groups items and counts the ones ready for gate 4', () => {
    const pack = buildPack(getService('plant-export-checks'))
    expect(pack.groups.map((group) => group.id)).toEqual([
      'service-design',
      'gate-4',
      'gate-5'
    ])
    expect(pack.totalCount).toBe(20)
    expect(pack.doneCount).toBe(8)
    expect(pack.items.find((item) => item.id === 'service-tier').done).toBe(
      true
    )
  })
})
