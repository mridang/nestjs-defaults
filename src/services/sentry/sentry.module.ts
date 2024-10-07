import {
  Module,
  DynamicModule,
  NestModule,
  MiddlewareConsumer,
} from '@nestjs/common';
import { SentryCoreModule } from './sentry-core.module';
import {
  SentryModuleOptions,
  SentryModuleAsyncOptions,
} from './sentry.interfaces';
import { NelMiddleware } from './nel/nel.middleware';

@Module({})
export class SentryModule implements NestModule {
  public static forRoot(options: SentryModuleOptions): DynamicModule {
    return {
      module: SentryModule,
      imports: [SentryCoreModule.forRoot(options)],
    };
  }

  public static forRootAsync(options: SentryModuleAsyncOptions): DynamicModule {
    return {
      module: SentryModule,
      imports: [SentryCoreModule.forRootAsync(options)],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(NelMiddleware).forRoutes('*');
  }
}
