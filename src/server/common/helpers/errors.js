import { statusCodes } from '../constants/status-codes.js'

const problem = {
  title: 'Sorry, there is a problem with the service',
  message: 'Try again later.'
}

/** Titles and text from the GOV.UK error page patterns. */
function errorPage(statusCode) {
  switch (statusCode) {
    case statusCodes.notFound:
      return { title: 'Page not found', notFound: true }
    case statusCodes.forbidden:
      return {
        title: 'You do not have permission to see this page',
        message: 'Ask your delivery lead for access.'
      }
    case statusCodes.unauthorized:
      return {
        title: 'You need to sign in to see this page',
        message: 'Sign in, then try again.'
      }
    default:
      return problem
  }
}

export function catchAll(request, h) {
  const { response } = request

  if (!('isBoom' in response)) {
    return h.continue
  }

  const statusCode = response.output.statusCode
  const page = errorPage(statusCode)

  if (statusCode >= statusCodes.internalServerError) {
    request.logger.error(response?.stack)
  }

  return h
    .view('error/index', {
      pageTitle: page.title,
      heading: page.title,
      message: page.message,
      notFound: Boolean(page.notFound)
    })
    .code(statusCode)
}
