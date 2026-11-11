/**
 * @file Public entry point that re-exports the defaults, logging, settings and services.
 */
export { default as configure } from './app.js';
export { ServerTiming } from './services/timing/index.js';
export { DefaultsModule, type DefaultsOptions } from './defaults.module.js';
export {
  BetterLogger,
  LOG_STRATEGY,
  selectStrategy,
  StructuredConsoleSink,
  StdoutJsonSink,
  PrettyConsoleSink,
  type LogStrategy,
  type LogSink,
  type HostInfo,
  type SelectStrategyOptions,
} from './logging/index.js';
export {
  EnvSecretsSource,
  AwsSecretsManagerSource,
  type SecretsSource,
} from './services/settings/source.js';
export { FetchImpl, CryptoImpl } from './services/core/index.js';
export {
  createSentryReporter,
  NoopSentryReporter,
  SdkSentryReporter,
  SENTRY_REPORTER,
  SentryInterceptor,
  SentryModule,
  type SentryBreadcrumb,
  type SentryLevel,
  type SentryReporter,
  type SentryReporterOptions,
  type SentrySdkLoaders,
} from './services/sentry/index.js';
export type { Request, Response, NextFunction } from 'express';
// eslint-disable-next-line sonarjs/no-wildcard-import -- re-exports preact's whole public surface, which an explicit list would drift from
export * from 'preact';
export { render } from 'preact-render-to-string';
export { type ConfigureOptions } from './app.js';
