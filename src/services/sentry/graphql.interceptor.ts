import { ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import type { GqlContextType } from '@nestjs/graphql';
import { SentryInterceptor } from '.';
import { extractRequestData, Scope } from '@sentry/node';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GqlExecutionContext: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ GqlExecutionContext } = require('@nestjs/graphql'));
  // eslint-disable-next-line no-empty
} catch {
  //
}

@Injectable()
export class GraphqlInterceptor extends SentryInterceptor {
  protected captureException(
    context: ExecutionContext,
    scope: Scope,
    exception: HttpException,
  ) {
    if (context.getType<GqlContextType>() === 'graphql') {
      this.captureGraphqlException(
        scope,
        GqlExecutionContext.create(context),
        exception,
      );
    } else {
      super.captureException(context, scope, exception);
    }
  }

  private captureGraphqlException(
    scope: Scope,
    gqlContext: typeof GqlExecutionContext,
    exception: HttpException,
  ): void {
    scope.setExtra('type', gqlContext.getInfo().parentType.name);
    if (gqlContext.getContext().req) {
      const data = extractRequestData(gqlContext.getContext().req, {});
      scope.setExtra('req', data.request);
      if (data.extra) scope.setExtras(data.extra);
      if (data.user) scope.setUser(data.user);
    }

    this.client.instance().captureException(exception);
  }
}
