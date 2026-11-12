/**
 * The questions that tailor a route, one per page, in order.
 * `changes` says what each answer adds to or removes from the route, and is
 * shown as hint text so people know why they are being asked.
 */
const questions = [
  {
    id: 'name',
    field: 'name',
    type: 'text',
    heading: 'What is the service called?',
    hint: 'The name people use for it, not the CDP service name.',
    error: 'Enter the name of the service',
    newServiceOnly: true
  },
  {
    id: 'approach',
    field: 'approach',
    type: 'radios',
    heading: 'Is the service delivered agile or waterfall?',
    hint: 'Both pass the same five gates. Only agile has service assessments.',
    error: 'Select agile or waterfall',
    options: [
      { value: 'agile', text: 'Agile' },
      { value: 'waterfall', text: 'Waterfall' }
    ]
  },
  {
    id: 'suppliers',
    field: 'suppliers',
    type: 'radios',
    heading: 'Are third-party suppliers delivering any of it?',
    hint: 'Suppliers add gate 2, delivery strategy.',
    error: 'Select yes if suppliers are delivering any of the service',
    options: [
      { value: 'true', text: 'Yes' },
      { value: 'false', text: 'No' }
    ]
  },
  {
    id: 'ai',
    field: 'usesAi',
    type: 'radios',
    heading: 'Does the service use AI?',
    hint: 'AI adds an algorithmic transparency record in alpha.',
    error: 'Select yes if the service uses AI',
    options: [
      { value: 'true', text: 'Yes' },
      { value: 'false', text: 'No' }
    ]
  },
  {
    id: 'platform',
    field: 'platform',
    type: 'radios',
    heading: 'Where does the service run?',
    hint: 'Connecting to the Azure platform adds onboarding and a design review board.',
    error: 'Select where the service runs',
    options: [
      { value: 'cdp', text: 'Core Delivery Platform only' },
      {
        value: 'azure',
        text: 'Core Delivery Platform, connected to the Azure platform'
      }
    ]
  },
  {
    id: 'size',
    field: 'size',
    type: 'radios',
    heading: 'How big is the change?',
    hint: 'Answer again later if it grows. Small services tend to.',
    error: 'Select how big the change is',
    options: [
      { value: 'small', text: 'Small', hint: 'One team, one journey' },
      {
        value: 'medium',
        text: 'Medium',
        hint: 'One service, more than one team'
      },
      {
        value: 'large',
        text: 'Large',
        hint: 'Several journeys, suppliers or departments'
      }
    ]
  },
  {
    id: 'go-live',
    field: 'goLive',
    type: 'date',
    heading: 'When does it need to go live?',
    hint: 'For example, 28 4 2028. Long waits are flagged against this date.',
    error: 'Enter the go-live date'
  }
]

export { questions }
