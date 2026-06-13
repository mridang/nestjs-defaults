import { expect, describe, test, jest } from '@jest/globals';
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { SentryInterceptor } from '../../../src/services/sentry/sentry.interceptor';
import {
  SentryReporter,
  NoopSentryReporter,
} from '../../../src/services/sentry/reporter';

/**
 * Drive the interceptor with a handler that throws the given error and return
 * how many times the reporter was asked to capture it.
 */
async function captureCountFor(error: unknown): Promise<number> {
  const reporter: SentryReporter = new NoopSentryReporter();
  const capture = jest.spyOn(reporter, 'captureException');
  const interceptor = new SentryInterceptor(reporter);
  const next: CallHandler = { handle: () => throwError(() => error) };

  await expect(
    lastValueFrom(interceptor.intercept({} as ExecutionContext, next)),
  ).rejects.toBe(error);

  return capture.mock.calls.length;
}

describe('SentryInterceptor', () => {
  test('reports non-HTTP errors', async () => {
    await expect(captureCountFor(new Error('boom'))).resolves.toBe(1);
  });

  test('reports HTTP 5xx errors', async () => {
    await expect(
      captureCountFor(new InternalServerErrorException()),
    ).resolves.toBe(1);
  });

  test('ignores HTTP 4xx errors', async () => {
    await expect(captureCountFor(new BadRequestException())).resolves.toBe(0);
  });

  test('sets the X-Exception-Id header with the captured event id', async () => {
    const reporter = new NoopSentryReporter();
    jest.spyOn(reporter, 'captureException').mockReturnValue('event-42');
    const setHeader = jest.fn();
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getResponse: () => ({ setHeader }) }),
    } as unknown as ExecutionContext;
    const interceptor = new SentryInterceptor(reporter);
    const next: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toThrow('boom');
    expect(setHeader).toHaveBeenCalledWith('X-Exception-Id', 'event-42');
  });

  test('passes successful responses through untouched', async () => {
    const reporter = new NoopSentryReporter();
    const capture = jest.spyOn(reporter, 'captureException');
    const interceptor = new SentryInterceptor(reporter);
    const next: CallHandler = { handle: () => of('ok') };

    await expect(
      lastValueFrom(interceptor.intercept({} as ExecutionContext, next)),
    ).resolves.toBe('ok');
    expect(capture).not.toHaveBeenCalled();
  });
});
