import {
  DynamicModule,
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  createSentryReporter,
  SENTRY_REPORTER,
  SentryReporter,
} from './reporter.js';
import { SentryInterceptor } from './sentry.interceptor.js';
import { NelController } from './nel/nel.controller.js';
import { NelMiddleware } from './nel/nel.middleware.js';

/**
 * Wires error reporting into the application.
 *
 * The module provides a single {@link SentryReporter}, selected for the active
 * runtime from the configured `SENTRY_DSN`, and reports server-side errors
 * through it via an interceptor. It also exposes the Network Error Logging
 * endpoint so browsers can report transport failures. With no DSN configured
 * the reporter is a no-op, so the module is safe to include everywhere.
 */
@Global()
@Module({})
export class SentryModule implements NestModule {
  /**
   * Build the module, reading Sentry configuration from {@link ConfigService}.
   *
   * @returns The configured dynamic module.
   */
  static forRoot(): DynamicModule {
    return {
      module: SentryModule,
      controllers: [NelController],
      providers: [
        {
          provide: SENTRY_REPORTER,
          inject: [ConfigService],
          useFactory: (config: ConfigService): Promise<SentryReporter> => {
            return createSentryReporter({
              dsn: config.get<string>('SENTRY_DSN'),
              environment: config.get<string>('NODE_ENV') ?? 'development',
              enabled: config.get<boolean>('SENTRY_ENABLED') !== false,
            });
          },
        },
        NelMiddleware,
        {
          provide: APP_INTERCEPTOR,
          inject: [SENTRY_REPORTER],
          useFactory: (reporter: SentryReporter): SentryInterceptor => {
            return new SentryInterceptor(reporter);
          },
        },
      ],
      exports: [SENTRY_REPORTER],
    };
  }

  /**
   * Advertise the Network Error Logging endpoint on every response.
   *
   * @param consumer The middleware consumer.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(NelMiddleware).forRoutes('*');
  }
}
