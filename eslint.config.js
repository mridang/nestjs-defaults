const mridangPlugin = require('@mridang/eslint-defaults');

module.exports = [
  ...mridangPlugin.configs.recommended,
  {
    // Always require braces around control-flow bodies — no single-line clauses.
    rules: {
      curly: ['error', 'all'],
    },
  },
];
