import { Global, MiddlewareConsumer, Module } from '@nestjs/common';
import { DefaultController } from './app.controller';
import { NodeModule } from './services/core/core.module';
import { BetterLogger } from './logger';
import { RequestIdMiddleware } from './correlation.middleware';
import { CoreInightsModule } from './services/insights.module';
import { CoreAssetsModule } from './services/assets.module';
import { CoreContinuationModule } from './services/clsstore.module';
import { SettingsModule } from './services/settings/settings.module';
import { TimingModule } from './services/timing';
import { VersionModule } from './services/version/version.module';

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
        TimingModule,
        VersionModule,
        CoreContinuationModule,
        CoreInightsModule,
        CoreAssetsModule,
      ],
      controllers: [DefaultController],
      providers: [BetterLogger],
      exports: [
        //
      ],
    };
  }
}
