import {
  Module,
  Global,
  Provider,
  Type,
  DynamicModule,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  SentryModuleAsyncOptions,
  SentryOptionsFactory,
  SentryModuleOptions,
} from './sentry.interfaces';
import { SENTRY_MODULE_OPTIONS, SENTRY_TOKEN } from './sentry.constants';
import { SentryService } from './sentry.service';
import { createSentryProviders } from './sentry.providers';
import { NelController } from './nel/nel.controller';
import { NelMiddleware } from './nel/nel.middleware';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SentryInterceptor } from './sentry.interceptor';

@Global()
@Module({})
export class SentryCoreModule {
  public static forRoot(options: SentryModuleOptions): DynamicModule {
    const provider = createSentryProviders(options);

    return {
      controllers: [NelController],
      exports: [provider, SentryService],
      module: SentryCoreModule,
      providers: [
        provider,
        SentryService,
        NelMiddleware,
        {
          provide: APP_INTERCEPTOR,
          useFactory: () =>
            new SentryInterceptor({
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
    const provider: Provider = {
      inject: [SENTRY_MODULE_OPTIONS],
      provide: SENTRY_TOKEN,
      useFactory: (options: SentryModuleOptions) => new SentryService(options),
    };

    return {
      controllers: [NelController],
      exports: [provider, SentryService],
      imports: options.imports,
      module: SentryCoreModule,
      providers: [
        ...this.createAsyncProviders(options),
        provider,
        SentryService,
        NelMiddleware,
        {
          provide: APP_INTERCEPTOR,
          useFactory: () =>
            new SentryInterceptor({
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
