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
 * Client errors (HTTP 4xx) are expected and left unreported; everything else —
 * non-HTTP errors and HTTP 5xx — is forwarded to the {@link SentryReporter}.
 * Request context is attached by the runtime SDK itself (`@sentry/node`'s HTTP
 * integration, or `withSentry` on Cloudflare Workers).
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
  /**
   * @param reporter The reporter errors are forwarded to.
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
   * Decide whether an error warrants reporting.
   *
   * @param error The error thrown downstream.
   * @returns True for non-HTTP errors and HTTP 5xx responses.
   */
  private static shouldReport(error: unknown): boolean {
    if (error instanceof HttpException) {
      return error.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR;
    }
    return true;
  }
}
