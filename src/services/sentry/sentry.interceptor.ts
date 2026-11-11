/**
 * @file Interceptor that reports unhandled errors from controllers to Sentry.
 */
import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SENTRY_REPORTER } from './reporter.js';
import type { SentryReporter } from './reporter.js';

/**
 * Reports server-side failures to Sentry as requests flow through.
 *
 * Client errors (HTTP 4xx) are expected and left unreported; everything else,
 * meaning non-HTTP errors and HTTP 5xx, is forwarded to the {@link SentryReporter}.
 * Request context is attached by the runtime SDK itself (`@sentry/node`'s HTTP
 * integration, or `withSentry` on Cloudflare Workers).
 * @example
 * ```ts
 * providers: [{ provide: APP_INTERCEPTOR, useClass: SentryInterceptor }]
 * ```
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
  /**
   * Creates the interceptor with the reporter that errors are forwarded to.
   * @param reporter - The reporter errors are forwarded to.
   * @example
   * ```ts
   * const interceptor = new SentryInterceptor(reporter);
   * ```
   */
  constructor(
    @Inject(SENTRY_REPORTER) private readonly reporter: SentryReporter,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap({
        error: (error: unknown): void => {
          if (!SentryInterceptor.shouldReport(error)) {
            return;
          }
          const eventId = this.reporter.captureException(error);
          if (eventId !== undefined && context.getType() === 'http') {
            context
              .switchToHttp()
              .getResponse<{ setHeader(name: string, value: string): void }>()
              .setHeader('X-Exception-Id', eventId);
          }
        },
      }),
    );
  }

  /**
   * Decides whether an error warrants reporting.
   * @param error - The error thrown downstream.
   * @returns True for non-HTTP errors and HTTP 5xx responses.
   * @example
   * ```ts
   * SentryInterceptor.shouldReport(new HttpException('gone', 404)); // false
   * ```
   */
  private static shouldReport(error: unknown): boolean {
    if (error instanceof HttpException) {
      return error.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR;
    }
    return true;
  }
}
