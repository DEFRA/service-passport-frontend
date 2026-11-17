import { vi } from 'vitest'

import { config } from '#/config/config.js'
import { isOpen, passwordGate } from './password-gate.js'

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

describe('#passwordGate with no password', () => {
  const settings = {
    password: config.get('passport.password'),
    isProduction: config.get('isProduction')
  }

  afterEach(() => {
    config.set('passport.password', settings.password)
    config.set('isProduction', settings.isProduction)
  })

  test('refuses to start in production', () => {
    config.set('passport.password', '')
    config.set('isProduction', true)
    const server = { ext: vi.fn() }

    expect(() => passwordGate.plugin.register(server)).toThrow(
      'PASSPORT_PASSWORD must be set in production'
    )
    expect(server.ext).not.toHaveBeenCalled()
  })

  test('turns the gate off outside production', () => {
    config.set('passport.password', '')
    config.set('isProduction', false)
    const server = { ext: vi.fn() }

    passwordGate.plugin.register(server)

    expect(server.ext).not.toHaveBeenCalled()
  })
})
