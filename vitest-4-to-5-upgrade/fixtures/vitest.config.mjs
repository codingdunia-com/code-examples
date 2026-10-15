import { defineConfig } from 'vitest/config'

// Deliberately empty. The point of this example is what each major version does
// with the SAME tests and the SAME (default) configuration.
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
})
