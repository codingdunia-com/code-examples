// No imports on purpose: this only works while `globals: true` reaches the run.
test('relies on a globals setting from a parent directory', () => {
  expect(1).toBe(1)
})
