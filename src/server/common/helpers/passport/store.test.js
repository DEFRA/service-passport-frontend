import {
  getService,
  listServices,
  resetStore,
  saveService,
  saveStamp
} from './store.js'

describe('#store', () => {
  afterEach(() => resetStore())

  test('seeds the example services', () => {
    expect(listServices().map((service) => service.id)).toContain(
      'plant-export-checks'
    )
    expect(getService('missing')).toBeNull()
  })

  test('adds a new service and replaces an existing one', () => {
    const before = listServices().length
    saveService({ id: 'new-one', name: 'New one', stamps: [], pack: [] })
    expect(listServices().length).toBe(before + 1)
    saveService({ id: 'new-one', name: 'Renamed', stamps: [], pack: [] })
    expect(listServices().length).toBe(before + 1)
    expect(getService('new-one').name).toBe('Renamed')
  })

  test('records a stamp and replaces it on the next decision', () => {
    saveStamp('plant-export-checks', {
      kind: 'step',
      id: 'accessibility-audit',
      status: 'approved-with-conditions',
      conditions: 'Fix the focus order'
    })
    let stamp = getService('plant-export-checks').stamps.find(
      (entry) => entry.step === 'accessibility-audit'
    )
    expect(stamp.status).toBe('approved-with-conditions')
    expect(stamp.conditions).toBe('Fix the focus order')

    saveStamp('plant-export-checks', {
      kind: 'step',
      id: 'accessibility-audit',
      status: 'approved'
    })
    stamp = getService('plant-export-checks').stamps.find(
      (entry) => entry.step === 'accessibility-audit'
    )
    expect(stamp.status).toBe('approved')
    expect(stamp.conditions).toBeUndefined()
  })

  test('keeps journey stamps apart from service stamps', () => {
    saveStamp('livestock-movement-notices', {
      kind: 'step',
      id: 'pen-test',
      journey: 'keeper-reports-a-move',
      status: 'booked'
    })
    const stamps = getService('livestock-movement-notices').stamps.filter(
      (entry) => entry.step === 'pen-test'
    )
    expect(stamps).toEqual([
      expect.objectContaining({
        journey: 'keeper-reports-a-move',
        status: 'booked'
      })
    ])
  })

  test('records a pack item status', () => {
    saveStamp('plant-export-checks', {
      kind: 'pack',
      id: 'soc-onboarding',
      status: 'done'
    })
    expect(
      getService('plant-export-checks').pack.find(
        (entry) => entry.item === 'soc-onboarding'
      ).status
    ).toBe('done')
  })

  test('returns null for an unknown service', () => {
    expect(
      saveStamp('missing', { kind: 'step', id: 'x', status: 'done' })
    ).toBeNull()
  })

  test('resets to the example data', () => {
    saveService({ id: 'temp', name: 'Temp', stamps: [], pack: [] })
    resetStore()
    expect(getService('temp')).toBeNull()
  })
})
