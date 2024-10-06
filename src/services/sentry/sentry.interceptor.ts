import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { HttpArgumentsHost, ContextType } from '@nestjs/common/interfaces';
import { tap } from 'rxjs/operators';
import { SentryService } from './sentry.service';
import { SentryInterceptorOptions } from './sentry.interfaces';
import { extractRequestData, Scope } from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  protected readonly client: SentryService =
    SentryService.SentryServiceInstance();
  constructor(private readonly options?: SentryInterceptorOptions) {
    //
  }

  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      tap({
        next: () => {},
        error: (exception: HttpException) => {
          if (this.shouldReport(exception)) {
            this.client.instance().withScope((scope) => {
              return this.captureException(context, scope, exception);
            });
          }
        },
      }),
    );
  }

  protected captureException(
    context: ExecutionContext,
    scope: Scope,
    exception: HttpException,
  ) {
    switch (context.getType<ContextType>()) {
      case 'http':
        return this.captureHttpException(
          scope,
          context.switchToHttp(),
          exception,
        );
    }
  }

  private captureHttpException(
    scope: Scope,
    http: HttpArgumentsHost,
    exception: HttpException,
  ) {
    const data = extractRequestData(http.getRequest(), this.options);

    scope.setExtra('req', data.request);

    if (data.extra) scope.setExtras(data.extra);
    if (data.user) scope.setUser(data.user);

    const exceptionId = this.client.instance().captureException(exception);
    http.getResponse().setHeader('X-Exception-Id', exceptionId);
  }

  private shouldReport(exception: HttpException) {
    return (
      !this.options?.filters ||
      !this.options.filters.some(
        ({ type, filter }) =>
          exception instanceof type && (!filter || filter(exception)),
      )
    );
  }
}
