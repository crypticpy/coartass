import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['lib/**/__tests__/**/*.test.ts', 'lib/__tests__/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: [
            'hooks/**/__tests__/**/*.test.ts',
            'hooks/**/__tests__/**/*.test.tsx',
            'components/**/__tests__/**/*.test.ts',
            'components/**/__tests__/**/*.test.tsx',
            'app/**/__tests__/**/*.test.ts',
            'app/**/__tests__/**/*.test.tsx',
          ],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['lib/**', 'hooks/**', 'components/**', 'app/**'],
      exclude: [
        '**/*.d.ts',
        '**/*.config.*',
        '**/node_modules/**',
        '**/.next/**',
      ],
    },
  },
});
