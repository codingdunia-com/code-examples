import { expect, test, vi } from 'vitest'

// Vitest 4: clearMocks defaults to false, so call history survives between tests.
// Vitest 5: clearMocks defaults to true, so vi.clearAllMocks() runs before each test.
const fn = vi.fn()

test('first test calls the mock', () => {
  fn()
  expect(fn).toHaveBeenCalledTimes(1)
})

test('second test counts the call from the first test', () => {
  fn()
  expect(fn).toHaveBeenCalledTimes(2)
})
