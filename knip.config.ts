/**
 * @file Configuration for Knip, which reports unused files, exports and dependencies.
 */
export default {
  ignore: ['knip.config.ts'],
  ignoreDependencies: [
    'cloudflare',
    /^@semantic-release\//,
    '@aws-sdk/client-secrets-manager',
  ],
};
