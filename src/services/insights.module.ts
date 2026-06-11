import { DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SentryModule } from './sentry';
import { SentryModuleOptions } from './sentry/sentry.interfaces';

/**
 * Builds the Sentry insights module.
 *
 * Sentry is enabled only when a `SENTRY_DSN` is configured (and not explicitly
 * disabled via `SENTRY_ENABLED=false`). A missing DSN no longer throws at boot,
 * so the module is safe to include on runtimes where Sentry is not configured.
 *
 * - `dsn`: Data Source Name for Sentry, from config (may be undefined).
 * - `environment`: Current environment, defaulting to `development`.
 * - `enabled`: True only when a DSN is present and not disabled.
 * - `logLevels`: `['debug']` when `SENTRY_DEBUG` is set, otherwise undefined.
 */
export function createInsightsModule(): DynamicModule {
  return SentryModule.forRootAsync({
    useFactory: async (configService: ConfigService) => {
      const dsn = configService.get<string>('SENTRY_DSN');
      return {
        // When absent, `enabled` is false so the DSN is never used; the cast
        // satisfies Sentry's strict template-literal DSN type.
        dsn: dsn as unknown as SentryModuleOptions['dsn'],
        environment: configService.get<string>('NODE_ENV') ?? 'development',
        enabled:
          !!dsn && configService.get<boolean>('SENTRY_ENABLED') !== false,
        logLevels: configService.get<boolean>('SENTRY_DEBUG')
          ? ['debug']
          : undefined,
      };
    },
    inject: [ConfigService],
  });
}
