import { describe, expect, test, vi } from 'vitest'

// vi.mock is hoisted to the top of the file at transform time, so calling it inside
// a describe block never scoped it to that block. Vitest 4 warned. Vitest 5 throws.
describe('mock declared inside describe', () => {
  vi.mock('node:os', () => ({ platform: () => 'mocked' }))

  test('still runs', async () => {
    const os = await import('node:os')
    expect(os.platform()).toBe('mocked')
  })
})
