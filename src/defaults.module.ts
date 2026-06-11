import { Global, MiddlewareConsumer, Module } from '@nestjs/common';
import { DefaultController } from './app.controller';
import { NodeModule } from './services/core/core.module';
import { BetterLogger } from './logger';
import { RequestIdMiddleware } from './correlation.middleware';
import { createInsightsModule } from './services/insights.module';
import { createAssetsModule } from './services/assets.module';
import { CoreContinuationModule } from './services/clsstore.module';
import {
  SettingsModule,
  SecretsSource,
} from './services/settings/settings.module';
import { TimingModule } from './services/timing';
import { VersionModule } from './services/version/version.module';

export interface DefaultsOptions {
  /** Name of the secret/config bundle. */
  configName: string;
  /**
   * Where config comes from. `'aws'` (default) keeps the historical AWS Secrets
   * Manager behaviour. Pass the Worker `env` object (or any function) to run
   * off AWS. See {@link SecretsSource}.
   */
  secrets?: SecretsSource;
  /**
   * Serve `public/` at `/static` via `@nestjs/serve-static`. Default true.
   * Set false on runtimes without a local filesystem (e.g. Cloudflare Workers,
   * where the Workers `assets` binding serves static files instead).
   */
  assets?: boolean;
  /**
   * Enable Sentry insights. Default true. Sentry self-disables when no
   * `SENTRY_DSN` is configured, so this only needs to be set false to keep the
   * `@sentry/node` SDK out of the runtime entirely (e.g. on Cloudflare Workers).
   */
  sentry?: boolean;
}

@Global()
@Module({})
export class DefaultsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }

  static register(options: DefaultsOptions) {
    const imports = [
      SettingsModule.register(options.configName, options.secrets ?? 'aws'),
      NodeModule,
      TimingModule,
      VersionModule,
      CoreContinuationModule,
      createAssetsModule(options.assets ?? true),
    ];

    if (options.sentry ?? true) {
      imports.push(createInsightsModule());
    }

    return {
      module: DefaultsModule,
      imports,
      controllers: [DefaultController],
      providers: [BetterLogger],
      exports: [
        //
      ],
    };
  }
}
