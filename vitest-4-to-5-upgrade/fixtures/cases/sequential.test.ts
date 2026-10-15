import { describe, expect, test } from 'vitest'

// describe.sequential and test.sequential were removed in Vitest 5.
// The replacement is the options object: { concurrent: false }.
describe.sequential('db suite', () => {
  test('writes the file', () => {
    expect(1 + 1).toBe(2)
  })
})
