import { vi } from 'vitest'

import { catchAll } from './errors.js'
import { createServer } from '../../server.js'
import { statusCodes } from '../constants/status-codes.js'

describe('#errors', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('A missing page uses the GOV.UK page not found pattern', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/non-existent-path'
    })

    expect(result).toEqual(
      expect.stringContaining('Page not found | Service Passport')
    )
    expect(result).toEqual(
      expect.stringContaining('check you copied the entire address')
    )
    expect(statusCode).toBe(statusCodes.notFound)
  })
})

describe('#catchAll', () => {
  const mockErrorLogger = vi.fn()
  const mockStack = 'Mock error stack'
  const errorPage = 'error/index'
  const mockRequest = (statusCode) => ({
    response: {
      isBoom: true,
      stack: mockStack,
      output: {
        statusCode
      }
    },
    logger: { error: mockErrorLogger }
  })
  const mockToolkitView = vi.fn()
  const mockToolkitCode = vi.fn()
  const mockToolkit = {
    view: mockToolkitView.mockReturnThis(),
    code: mockToolkitCode.mockReturnThis()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test.each([
    [statusCodes.notFound, 'Page not found', undefined, true],
    [
      statusCodes.forbidden,
      'Your session timed out',
      'Go back, reload the page and try again.',
      false
    ],
    [
      statusCodes.unauthorized,
      'You need to sign in to see this page',
      'Sign in, then try again.',
      false
    ],
    [
      statusCodes.badRequest,
      'Sorry, there is a problem with the service',
      'Try again later.',
      false
    ],
    [
      statusCodes.imATeapot,
      'Sorry, there is a problem with the service',
      'Try again later.',
      false
    ]
  ])(
    'A %i error shows "%s" and is not logged',
    (statusCode, title, message, notFound) => {
      catchAll(mockRequest(statusCode), mockToolkit)

      expect(mockErrorLogger).not.toHaveBeenCalled()
      expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
        pageTitle: title,
        heading: title,
        message,
        notFound
      })
      expect(mockToolkitCode).toHaveBeenCalledWith(statusCode)
    }
  )

  test('A server error shows the problem page and logs the stack', () => {
    catchAll(mockRequest(statusCodes.internalServerError), mockToolkit)

    expect(mockErrorLogger).toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Sorry, there is a problem with the service',
      heading: 'Sorry, there is a problem with the service',
      message: 'Try again later.',
      notFound: false
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(
      statusCodes.internalServerError
    )
  })
})
