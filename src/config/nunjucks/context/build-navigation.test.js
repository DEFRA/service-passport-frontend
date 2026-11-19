import { buildNavigation } from './build-navigation.js'

function requestAt(path, passport) {
  return { path, yar: { get: () => passport } }
}

describe('buildNavigation', () => {
  test('shows every link before a route is confirmed', () => {
    const items = buildNavigation(requestAt('/about-your-service', {}))
    expect(items.map((item) => item.text)).toEqual([
      'Passport',
      'Dashboard',
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
    ['/dashboard', 'Dashboard'],
    ['/dashboard/route', 'Dashboard'],
    ['/passport/ask', 'Ask'],
    ['/about-your-service/check', 'Service']
  ])('marks %s as under %s', (path, current) => {
    const items = buildNavigation(requestAt(path, { confirmed: true }))
    expect(items.map((item) => item.text)).toEqual([
      'Passport',
      'Dashboard',
      'Service',
      'Ask'
    ])
    expect(
      items.filter((item) => item.current).map((item) => item.text)
    ).toEqual([current])
  })

  test('leaves the calendar unlinked', () => {
    const items = buildNavigation(requestAt('/calendar'))
    expect(items.some((item) => item.href === '/calendar')).toBe(false)
    expect(items.some((item) => item.current)).toBe(false)
  })
})
