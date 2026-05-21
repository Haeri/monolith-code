const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'build/**',
      'dist/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.node,
        ace: 'readonly',
        getExeExtension: 'readonly',
        mergeDeep: 'readonly',
        requireLazy: 'readonly',
      },
    },
    rules: {},
  },
];
