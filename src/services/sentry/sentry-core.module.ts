import {
  Module,
  Global,
  DynamicModule,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  SentryModuleAsyncOptions,
  SentryModuleOptions,
} from './sentry.interfaces';
import { SentryService } from './sentry.service';
import { NelController } from './nel/nel.controller';
import { NelMiddleware } from './nel/nel.middleware';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SentryInterceptor } from './sentry.interceptor';
import { SENTRY_MODULE_OPTIONS } from './sentry.constants';

@Global()
@Module({})
export class SentryCoreModule {
  public static forRoot(options: SentryModuleOptions): DynamicModule {
    return {
      controllers: [NelController],
      exports: [SentryService],
      module: SentryCoreModule,
      providers: [
        {
          provide: SENTRY_MODULE_OPTIONS,
          useValue: options,
        },
        SentryService,
        NelMiddleware,
        {
          provide: APP_INTERCEPTOR,
          inject: [SentryService],
          useFactory: (sentryService: SentryService) =>
            new SentryInterceptor(sentryService, {
              filters: [
                {
                  type: HttpException,
                  filter: (exception: HttpException) =>
                    HttpStatus.INTERNAL_SERVER_ERROR > exception.getStatus(),
                },
              ],
            }),
        },
      ],
    };
  }

  public static forRootAsync(options: SentryModuleAsyncOptions): DynamicModule {
    return {
      controllers: [NelController],
      exports: [SentryService],
      imports: options.imports,
      module: SentryCoreModule,
      providers: [
        SentryService,
        NelMiddleware,
        {
          provide: APP_INTERCEPTOR,
          inject: [SentryService],
          useFactory: (sentryService: SentryService) =>
            new SentryInterceptor(sentryService, {
              filters: [
                {
                  type: HttpException,
                  filter: (exception: HttpException) =>
                    HttpStatus.INTERNAL_SERVER_ERROR > exception.getStatus(),
                },
              ],
            }),
        },
      ],
    };
  }
}
