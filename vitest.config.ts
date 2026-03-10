import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/backend/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/backend/**/*.ts'],
      exclude: ['src/backend/**/*.test.ts', 'src/backend/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@backend': path.resolve(__dirname, './src/backend'),
    },
  },
})
