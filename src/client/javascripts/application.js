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
