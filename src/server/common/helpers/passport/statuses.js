/**
 * The statuses a stamp can hold, in the order a step moves through them.
 * `done` marks a status that needs no more action from the delivery lead.
 */
const statuses = [
  { id: 'not-started', text: 'Not started', colour: 'grey', done: false },
  { id: 'in-progress', text: 'In progress', colour: 'light-blue', done: false },
  { id: 'booked', text: 'Booked', colour: 'blue', done: false },
  { id: 'submitted', text: 'Submitted', colour: 'blue', done: false },
  { id: 'approved', text: 'Approved', colour: 'green', done: true },
  {
    id: 'approved-with-conditions',
    text: 'Approved with conditions',
    colour: 'green',
    done: true
  },
  { id: 'not-approved', text: 'Not approved', colour: 'red', done: false },
  { id: 'done', text: 'Done', colour: 'green', done: true }
]

const statusIds = statuses.map((status) => status.id)

/**
 * @param {string} id
 * @returns {object} the status, or "Not started" when unknown
 */
function getStatus(id) {
  return statuses.find((status) => status.id === id) ?? statuses[0]
}

/**
 * The GOV.UK tag for a status.
 * @param {string} id
 */
function statusTag(id) {
  const status = getStatus(id)
  return {
    text: status.text,
    classes:
      status.colour === 'grey'
        ? 'govuk-tag--grey'
        : `govuk-tag--${status.colour}`
  }
}

export { getStatus, statusIds, statusTag, statuses }
