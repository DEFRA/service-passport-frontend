import {
  createAll,
  Button,
  CharacterCount,
  Checkboxes,
  ErrorSummary,
  NotificationBanner,
  Radios,
  SkipLink
} from 'govuk-frontend'
import cookies from './cookies.js'

cookies.init()

createAll(Button)
createAll(CharacterCount)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(NotificationBanner)
createAll(Radios)
createAll(SkipLink)

/**
 * Opens and closes the service navigation on a phone. Without this script
 * the links show as a column and the toggle stays hidden.
 */
function initServiceNavigation() {
  const toggle = document.querySelector('.defra-service-navigation__toggle')
  const list = document.querySelector('.defra-service-navigation__list')
  if (!toggle || !list) {
    return
  }
  toggle.hidden = false
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true'
    toggle.setAttribute('aria-expanded', String(!open))
    list.classList.toggle('defra-service-navigation__list--open', !open)
  })
}

initServiceNavigation()

/**
 * After a question, the page reloads at the new answer. Moving focus to its
 * heading puts screen reader users at the answer, not the top of the page.
 */
function focusAnswer() {
  const target = window.location.hash.startsWith('#answer-')
    ? document.getElementById(window.location.hash.slice(1))
    : null
  target?.focus()
}

focusAnswer()

const readingSeconds = 3

/**
 * Stands in for AI reading the service on CDP. The status line announces
 * when it finishes, then the page moves on to what AI found. Continue is
 * hidden because the page moves on by itself.
 */
function readService() {
  const page = document.querySelector('[data-module="app-reading"]')
  if (!page) {
    return
  }
  const status = page.querySelector('.app-reading__status')
  const spinner = page.querySelector('.app-spinner')
  const button = page.querySelector('.app-reading__continue')
  if (button) {
    button.classList.add('govuk-!-display-none')
  }
  window.setTimeout(() => {
    spinner?.remove()
    status.textContent = 'AI has finished reading your service.'
    window.location.assign(page.dataset.next)
  }, readingSeconds * 1000)
}

readService()
