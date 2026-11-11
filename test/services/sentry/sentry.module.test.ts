/**
 * @file Tests for the Sentry module, covering reporter selection from configuration.
 */
import { expect, describe, test } from '@jest/globals';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SentryModule } from '../../../src/services/sentry/sentry.module';
import {
  NoopSentryReporter,
  SENTRY_REPORTER,
  SentryReporter,
} from '../../../src/services/sentry/reporter';

/**
 * Compiles {@link SentryModule} with the given configuration values exposed
 * through a global {@link ConfigModule}.
 * @param config - The configuration values to expose.
 * @returns The compiled testing module.
 * @example
 * ```ts
 * const moduleRef = await compile({ SENTRY_ENABLED: false });
 * ```
 */
async function compile(config: Record<string, unknown>) {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => config],
      }),
      SentryModule.forRoot(),
    ],
  }).compile();
}

describe('SentryModule', () => {
  test('provides a no-op reporter when no DSN is configured', async () => {
    const moduleRef = await compile({});

    const reporter = moduleRef.get<SentryReporter>(SENTRY_REPORTER);

    expect(reporter).toBeInstanceOf(NoopSentryReporter);
  });

  test('honours SENTRY_ENABLED=false even when a DSN is present', async () => {
    const moduleRef = await compile({
      SENTRY_DSN: 'https://client@account.ingest.sentry.io/1',
      SENTRY_ENABLED: false,
    });

    expect(moduleRef.get<SentryReporter>(SENTRY_REPORTER)).toBeInstanceOf(
      NoopSentryReporter,
    );
  });
});
