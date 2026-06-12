import { expect, describe, test, jest } from '@jest/globals';
import {
  createSentryReporter,
  NoopSentryReporter,
  SdkSentryReporter,
} from '../../../src/services/sentry/reporter';

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
  test('delegates every call to the loaded SDK', () => {
    const sentry = {
      captureException: jest.fn(() => 'event-id'),
      captureMessage: jest.fn(() => 'message-id'),
      addBreadcrumb: jest.fn(),
      close: jest.fn(async () => true),
    };
    const reporter = new SdkSentryReporter(sentry);
    const error = new Error('boom');

    expect(reporter.captureException(error)).toBe('event-id');
    reporter.captureMessage('hi', 'warning');
    reporter.addBreadcrumb({ message: 'crumb', level: 'debug' });

    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(sentry.captureMessage).toHaveBeenCalledWith('hi', 'warning');
    expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: 'crumb',
      level: 'debug',
    });
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
      createSentryReporter({
        dsn: 'https://client@account.ingest.sentry.io/1',
        enabled: false,
      }),
    ).resolves.toBeInstanceOf(NoopSentryReporter);
  });
});
