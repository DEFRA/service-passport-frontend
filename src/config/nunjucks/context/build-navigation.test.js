import { buildNavigation } from './build-navigation.js'

function requestAt(path, passport) {
  return { path, yar: { get: () => passport } }
}

describe('buildNavigation', () => {
  test('shows nothing before a route is confirmed', () => {
    expect(buildNavigation(requestAt('/about-your-service', {}))).toEqual([])
    expect(buildNavigation({ path: '/' })).toEqual([])
  })

  test.each([
    ['/passport', 'Passport'],
    ['/passport/pen-test', 'Passport'],
    ['/plan', 'Plan'],
    ['/about-your-service/check', 'About your service']
  ])('marks %s as under %s', (path, current) => {
    const items = buildNavigation(requestAt(path, { confirmed: true }))
    expect(items.map((item) => item.text)).toEqual([
      'Passport',
      'Plan',
      'About your service'
    ])
    expect(
      items.filter((item) => item.current).map((item) => item.text)
    ).toEqual([current])
  })
})
