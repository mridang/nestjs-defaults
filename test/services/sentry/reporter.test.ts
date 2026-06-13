import { expect, describe, test, jest } from '@jest/globals';
import {
  createSentryReporter,
  NoopSentryReporter,
  SdkSentryReporter,
  SentrySdkLoaders,
} from '../../../src/services/sentry/reporter';

/**
 * Build a fake Sentry SDK plus spies for asserting delegation.
 */
function fakeSdk() {
  return {
    captureException: jest.fn(() => 'event-id'),
    captureMessage: jest.fn(() => 'message-id'),
    addBreadcrumb: jest.fn(),
    close: jest.fn(async () => true),
    init: jest.fn(),
  };
}

const DSN = 'https://client@account.ingest.sentry.io/1';

describe('NoopSentryReporter', () => {
  const reporter = new NoopSentryReporter();

  test('captureException yields no event id', () => {
    expect(reporter.captureException(new Error('boom'))).toBeUndefined();
  });

  test('captureMessage and addBreadcrumb are silent', () => {
    expect(() => {
      reporter.captureMessage('hi', 'info');
      reporter.addBreadcrumb({ message: 'hi', level: 'info' });
    }).not.toThrow();
  });

  test('close resolves true', async () => {
    await expect(reporter.close()).resolves.toBe(true);
  });
});

describe('SdkSentryReporter', () => {
  test('delegates every call to the loaded SDK', async () => {
    const sentry = fakeSdk();
    const reporter = new SdkSentryReporter(sentry);
    const error = new Error('boom');

    expect(reporter.captureException(error)).toBe('event-id');
    reporter.captureMessage('hi', 'warning');
    reporter.addBreadcrumb({ message: 'crumb', level: 'debug' });
    await expect(reporter.close(1000)).resolves.toBe(true);

    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(sentry.captureMessage).toHaveBeenCalledWith('hi', 'warning');
    expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: 'crumb',
      level: 'debug',
    });
    expect(sentry.close).toHaveBeenCalledWith(1000);
  });
});

describe('createSentryReporter', () => {
  test('returns a no-op reporter when no DSN is configured', async () => {
    await expect(createSentryReporter({})).resolves.toBeInstanceOf(
      NoopSentryReporter,
    );
  });

  test('returns a no-op reporter when explicitly disabled', async () => {
    await expect(
      createSentryReporter({ dsn: DSN, enabled: false }),
    ).resolves.toBeInstanceOf(NoopSentryReporter);
  });

  test('loads @sentry/cloudflare on Workers without initialising it', async () => {
    const cloudflare = fakeSdk();
    const loaders: SentrySdkLoaders = {
      loadCloudflare: async () => cloudflare,
      loadNode: async () => {
        throw new Error('node SDK must not be loaded on Workers');
      },
    };

    const reporter = await createSentryReporter(
      { dsn: DSN, onCloudflareWorkers: true },
      loaders,
    );

    expect(reporter).toBeInstanceOf(SdkSentryReporter);
    expect(cloudflare.init).not.toHaveBeenCalled();
  });

  test('loads and initialises @sentry/node off Workers', async () => {
    const node = fakeSdk();
    const loaders: SentrySdkLoaders = {
      loadCloudflare: async () => {
        throw new Error('cloudflare SDK must not be loaded on Node');
      },
      loadNode: async () => node,
    };

    const reporter = await createSentryReporter(
      { dsn: DSN, environment: 'production', onCloudflareWorkers: false },
      loaders,
    );

    expect(reporter).toBeInstanceOf(SdkSentryReporter);
    expect(node.init).toHaveBeenCalledWith({
      dsn: DSN,
      environment: 'production',
    });
  });
});
