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

const progressStepMs = 1000

function hide(element) {
  element?.classList.add('govuk-!-display-none')
}

function show(element) {
  element?.classList.remove('govuk-!-display-none')
}

/** Sets a task list status to a spinner and "Checking". */
function setChecking(status) {
  const spinner = document.createElement('span')
  spinner.className = 'app-spinner'
  spinner.setAttribute('aria-hidden', 'true')
  status.replaceChildren(spinner, document.createTextNode('Checking'))
}

/**
 * Stands in for the passport reading from CDP. Each task on the page
 * starts as "Checking" and turns to "Done" in turn, showing what it found.
 * When all are done, the status line announces it and the rest of the
 * page appears.
 * Without JavaScript the page arrives finished.
 */
function runProgress() {
  const page = document.querySelector('[data-module="app-progress"]')
  if (!page) {
    return
  }
  const tasks = [...page.querySelectorAll('.govuk-task-list__item')].map(
    (item) => {
      const status = item.querySelector('.govuk-task-list__status')
      const hint = item.querySelector('.govuk-task-list__hint')
      const done = status.textContent.trim()
      setChecking(status)
      hide(hint)
      return { status, hint, done }
    }
  )
  const after = page.querySelectorAll('[data-progress-after]')
  const live = page.querySelector('[data-progress-live]')
  after.forEach(hide)

  tasks.forEach((task, index) => {
    window.setTimeout(
      () => {
        task.status.textContent = task.done
        show(task.hint)
        if (index === tasks.length - 1) {
          finish()
        }
      },
      (index + 1) * progressStepMs
    )
  })

  function finish() {
    if (live) {
      live.textContent = live.dataset.progressLive
    }
    after.forEach(show)
  }
}

runProgress()
