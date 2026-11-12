import { buildNavigation } from './build-navigation.js'

describe('#buildNavigation', () => {
  test('marks the programme link current on the front page', () => {
    expect(buildNavigation({ path: '/' })).toEqual([
      { text: 'Programme', href: '/', current: true }
    ])
  })

  test('does not mark the programme link current elsewhere', () => {
    expect(buildNavigation({ path: '/services/x' })).toEqual([
      { text: 'Programme', href: '/', current: false }
    ])
  })
})
