import {
  Module,
  Global,
  DynamicModule,
  HttpException,
  HttpStatus,
  Provider,
  Type,
} from '@nestjs/common';
import {
  SentryModuleAsyncOptions,
  SentryModuleOptions,
  SentryOptionsFactory,
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
        ...this.createAsyncProviders(options),
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

  private static createAsyncProviders(
    options: SentryModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }
    const useClass = options.useClass as Type<SentryOptionsFactory>;
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: SentryModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        inject: options.inject || [],
        provide: SENTRY_MODULE_OPTIONS,
        useFactory: options.useFactory,
      };
    }
    const inject = [
      (options.useClass || options.useExisting) as Type<SentryOptionsFactory>,
    ];
    return {
      provide: SENTRY_MODULE_OPTIONS,
      useFactory: async (optionsFactory: SentryOptionsFactory) =>
        await optionsFactory.createSentryModuleOptions(),
      inject,
    };
  }
}
