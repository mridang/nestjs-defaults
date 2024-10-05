import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  HttpArgumentsHost,
  WsArgumentsHost,
  RpcArgumentsHost,
  ContextType,
} from '@nestjs/common/interfaces';
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
      case 'rpc':
        return this.captureRpcException(
          scope,
          context.switchToRpc(),
          exception,
        );
      case 'ws':
        return this.captureWsException(scope, context.switchToWs(), exception);
    }
  }

  private captureHttpException(
    scope: Scope,
    http: HttpArgumentsHost,
    exception: HttpException,
  ): void {
    const data = extractRequestData(http.getRequest(), this.options);

    scope.setExtra('req', data.request);

    if (data.extra) scope.setExtras(data.extra);
    if (data.user) scope.setUser(data.user);

    this.client.instance().captureException(exception);
  }

  private captureRpcException(
    scope: Scope,
    rpc: RpcArgumentsHost,
    exception: HttpException,
  ): void {
    scope.setExtra('rpc_data', rpc.getData());

    this.client.instance().captureException(exception);
  }

  private captureWsException(
    scope: Scope,
    ws: WsArgumentsHost,
    exception: HttpException,
  ): void {
    scope.setExtra('ws_client', ws.getClient());
    scope.setExtra('ws_data', ws.getData());

    this.client.instance().captureException(exception);
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
