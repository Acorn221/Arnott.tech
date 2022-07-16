module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'plugin:react/recommended',
    'airbnb',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: [
    'react',
    '@typescript-eslint',
  ],
  rules: {
    'react/function-component-definition': [2, {
      namedComponents: 'arrow-function',
      unnamedComponents: 'arrow-function',
    }],
    'linebreak-style': 0,
    'no-plusplus': 0,
    'no-tabs': ['error', { allowIndentationTabs: true }],
    'import/extensions': 0,
    'import/no-unresolved': 0, // TODO: fix at some point
    'jsx-a11y/click-events-have-key-events': 0,
    'jsx-a11y/no-static-element-interactions': 0,
    'react/forbid-prop-types': 0, // TODO: remove and fix these before prod!
    'react/react-in-jsx-scope': 0,
    'react/require-default-props': 0,
    'no-unused-vars': 0,
    'max-len': 0,
    'react/jsx-filename-extension': 0,
    'react/button-has-type': 0,
    'jsx-a11y/anchor-is-valid': 0,
    'jsx-a11y/alt-text': 0,
    'no-bitwise': 0,
    'react/jsx-props-no-spreading': 0,
    'react/prop-types': 0,
    'no-console': 0,
    'no-alert': 0,
  },
};
