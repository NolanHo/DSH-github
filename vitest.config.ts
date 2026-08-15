import { defineConfig } from 'vitest/config'

// The npm-published primitives package imports katex CSS at the top of its
// built lib — Node's external loader chokes on the .css extension unless the
// package is inlined through Vite's transform (css: false stubs it).
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'],
    environment: 'node',
    css: false,
    server: {
      deps: {
        inline: [/@deepseek-ai\/dsh-client-ui-primitives/],
      },
    },
  },
})
