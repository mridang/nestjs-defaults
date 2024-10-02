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
    const info = gqlContext.getInfo();
    const context = gqlContext.getContext();

    scope.setExtra('type', info.parentType.name);

    if (context.req) {
      // req within graphql context needs modification in
      const data = extractRequestData(context.req, {});

      scope.setExtra('req', data.request);

      if (data.extra) scope.setExtras(data.extra);
      if (data.user) scope.setUser(data.user);
    }

    this.client.instance().captureException(exception);
  }
}
