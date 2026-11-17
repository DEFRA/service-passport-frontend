import { vi } from 'vitest'
import createFetchMock from 'vitest-fetch-mock'

const fetchMock = createFetchMock(vi)

fetchMock.enableMocks()
global.fetch = fetchMock

vi.mock('ioredis')

// Tests that need the password gate set it themselves, so a password in
// the shell never gates the rest.
process.env.PASSPORT_PASSWORD = ''
