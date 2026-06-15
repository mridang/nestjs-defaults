import { Global, MiddlewareConsumer, Module } from '@nestjs/common';
import { DefaultController } from './app.controller.js';
import { NodeModule } from './services/core/core.module.js';
import { BetterLogger } from './logging/index.js';
import { RequestIdMiddleware } from './correlation.middleware.js';
import { createInsightsModule } from './services/insights.module.js';
import { createAssetsModule } from './services/assets.module.js';
import { CoreContinuationModule } from './services/clsstore.module.js';
import { SettingsModule } from './services/settings/settings.module.js';
import { EnvSecretsSource, SecretsSource } from './services/settings/source.js';
import { TimingModule } from './services/timing/index.js';
import { VersionModule } from './services/version/version.module.js';

export interface DefaultsOptions {
  /**
   * Where configuration secrets come from. Defaults to {@link EnvSecretsSource}
   * (the process environment), which is correct for Cloudflare Workers and
   * local development; pass an {@link AwsSecretsManagerSource} to load from AWS.
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
   * `SENTRY_DSN` is configured; the SDK for the active runtime is loaded only
   * when a DSN is present, so this rarely needs to be set false.
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
      SettingsModule.register(options.secrets ?? new EnvSecretsSource()),
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
      exports: [],
    };
  }
}
