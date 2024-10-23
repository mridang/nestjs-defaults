import {
  Inject,
  Injectable,
  ConsoleLogger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ClientOptions, Client } from '@sentry/types';
import * as Sentry from '@sentry/node';
import { SENTRY_MODULE_OPTIONS } from './sentry.constants';
import { SentryModuleOptions } from './sentry.interfaces';

@Injectable()
export class SentryService
  extends ConsoleLogger
  implements OnApplicationShutdown
{
  app = '@mridang/nestjs-defaults: ';
  constructor(
    @Inject(SENTRY_MODULE_OPTIONS)
    private readonly opts: SentryModuleOptions,
  ) {
    super();
    const { integrations = [], ...sentryOptions } = opts;
    Sentry.init({
      ...sentryOptions,
      integrations: [
        Sentry.onUncaughtExceptionIntegration({
          onFatalError: async (err: Error) => {
            if (err.name === 'SentryError') {
              console.log(err);
            } else {
              (
                Sentry.getClient<
                  Client<ClientOptions>
                >() as Client<ClientOptions>
              ).captureException(err);
              process.exit(1);
            }
          },
        }),
        Sentry.onUnhandledRejectionIntegration({ mode: 'warn' }),
        ...integrations,
      ],
    });
  }

  log(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;

    super.log(message, context);
    if (asBreadcrumb) {
      Sentry.addBreadcrumb({
        message,
        level: 'log',
        data: {
          context,
        },
      });
    } else {
      Sentry.captureMessage(message, 'log');
    }
  }

  error(message: string, trace?: string, context?: string) {
    message = `${this.app} ${message}`;

    super.error(message, trace, context);
    Sentry.captureMessage(message, 'error');
  }

  warn(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;

    super.warn(message, context);
    if (asBreadcrumb) {
      Sentry.addBreadcrumb({
        message,
        level: 'warning',
        data: {
          context,
        },
      });
    } else {
      Sentry.captureMessage(message, 'warning');
    }
  }

  debug(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;

    super.debug(message, context);
    if (asBreadcrumb) {
      Sentry.addBreadcrumb({
        message,
        level: 'debug',
        data: {
          context,
        },
      });
    } else {
      Sentry.captureMessage(message, 'debug');
    }
  }

  verbose(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;

    super.verbose(message, context);
    if (asBreadcrumb) {
      Sentry.addBreadcrumb({
        message,
        level: 'info',
        data: {
          context,
        },
      });
    } else {
      Sentry.captureMessage(message, 'info');
    }
  }

  instance() {
    return Sentry;
  }

  async onApplicationShutdown() {
    if (this.opts?.close?.enabled === true) {
      await Sentry.close(this.opts?.close.timeout);
    }
  }
}
