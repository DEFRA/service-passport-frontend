import { isOpen } from './password-gate.js'

describe('#isOpen', () => {
  test('leaves the sign-in page, health check, cookies and assets open', () => {
    expect(isOpen('/sign-in')).toBe(true)
    expect(isOpen('/health')).toBe(true)
    expect(isOpen('/cookies')).toBe(true)
    expect(isOpen('/public/assets/x.css')).toBe(true)
  })

  test('gates everything else', () => {
    expect(isOpen('/')).toBe(false)
    expect(isOpen('/services/x')).toBe(false)
  })
})
