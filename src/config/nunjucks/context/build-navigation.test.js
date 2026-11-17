import { buildNavigation } from './build-navigation.js'

function requestAt(path, passport) {
  return { path, yar: { get: () => passport } }
}

describe('buildNavigation', () => {
  test('shows every link before a route is confirmed', () => {
    const items = buildNavigation(requestAt('/about-your-service', {}))
    expect(items.map((item) => item.text)).toEqual([
      'Passport',
      'Calendar',
      'Service',
      'Ask'
    ])
    expect(
      items.filter((item) => item.current).map((item) => item.text)
    ).toEqual(['Service'])
    expect(
      buildNavigation({ path: '/' }).filter((item) => item.current)
    ).toEqual([])
  })

  test.each([
    ['/passport', 'Passport'],
    ['/passport/pen-test', 'Passport'],
    ['/calendar', 'Calendar'],
    ['/passport/ask', 'Ask'],
    ['/about-your-service/check', 'Service']
  ])('marks %s as under %s', (path, current) => {
    const items = buildNavigation(requestAt(path, { confirmed: true }))
    expect(items.map((item) => item.text)).toEqual([
      'Passport',
      'Calendar',
      'Service',
      'Ask'
    ])
    expect(
      items.filter((item) => item.current).map((item) => item.text)
    ).toEqual([current])
  })
})
