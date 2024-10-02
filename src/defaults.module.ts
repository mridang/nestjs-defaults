import {
  Global,
  HttpException,
  HttpStatus,
  MiddlewareConsumer,
  Module,
} from '@nestjs/common';
import { DefaultController } from './app.controller';
import { NodeModule } from './services/core/core.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TimingInterceptor } from './timing.interceptor';
import { BetterLogger } from './logger';
import { RequestIdMiddleware } from './correlation.middleware';
import { CoreInightsModule } from './services/insights.module';
import { CoreAssetsModule } from './services/assets.module';
import { CoreContinuationModule } from './services/clsstore.module';
import { SettingsModule } from './services/settings/settings.module';
import { SentryInterceptor } from './services/sentry';

@Global()
@Module({})
export class DefaultsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }

  static register(options: { configName: string }) {
    return {
      module: DefaultsModule,
      imports: [
        SettingsModule.register(options.configName),
        NodeModule,
        CoreContinuationModule,
        CoreInightsModule,
        CoreAssetsModule,
      ],
      controllers: [DefaultController],
      providers: [
        BetterLogger,
        {
          provide: APP_INTERCEPTOR,
          useClass: TimingInterceptor,
        },
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
      exports: [
        //
      ],
    };
  }
}
