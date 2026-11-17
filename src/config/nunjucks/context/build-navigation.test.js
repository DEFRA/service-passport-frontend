import { buildNavigation } from './build-navigation.js'

function requestAt(path, passport) {
  return { path, yar: { get: () => passport } }
}

describe('buildNavigation', () => {
  test('shows every link before a route is confirmed', () => {
    const items = buildNavigation(requestAt('/about-your-service', {}))
    expect(items.map((item) => item.text)).toEqual([
      'Passport',
      'Plan',
      'About your service',
      'Ask'
    ])
    expect(
      items.filter((item) => item.current).map((item) => item.text)
    ).toEqual(['About your service'])
    expect(
      buildNavigation({ path: '/' }).filter((item) => item.current)
    ).toEqual([])
  })

  test.each([
    ['/passport', 'Passport'],
    ['/passport/pen-test', 'Passport'],
    ['/plan', 'Plan'],
    ['/passport/ask', 'Ask'],
    ['/about-your-service/check', 'About your service']
  ])('marks %s as under %s', (path, current) => {
    const items = buildNavigation(requestAt(path, { confirmed: true }))
    expect(items.map((item) => item.text)).toEqual([
      'Passport',
      'Plan',
      'About your service',
      'Ask'
    ])
    expect(
      items.filter((item) => item.current).map((item) => item.text)
    ).toEqual([current])
  })
})
