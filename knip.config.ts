export default {
  ignore: ['knip.config.ts'],
  ignoreDependencies: [
    'cloudflare',
    /^@semantic-release\//,
    '@aws-sdk/client-secrets-manager',
  ],
};
