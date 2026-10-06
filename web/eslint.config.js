import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-e2e', 'node_modules', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**', 'tests/**', 'e2e/**', '*.config.*'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // Guardrails: no persistence of secrets, no dynamic code.
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'unpassword never persists file data or passwords.' },
        { name: 'sessionStorage', message: 'unpassword never persists file data or passwords.' },
        { name: 'indexedDB', message: 'unpassword never persists file data or passwords.' },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
);
