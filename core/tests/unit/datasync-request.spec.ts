import { it, expect } from 'vitest'
import { dataSyncHeaders } from '../../src/features/datasync/app/utils/request'
it('includes the current session CSRF token for Data Sync mutations', () => {
  const headers = dataSyncHeaders('session-csrf', {
    'content-type': 'application/json',
  })
  expect(headers.get('x-couchdb-csrf')).toBe('session-csrf')
  expect(headers.get('content-type')).toBe('application/json')
})
