import { ConfigService } from '@nestjs/config';
import { SentryModule } from './sentry';

/**
 * The `CoreInsightsModule` is an asynchronous configuration for the
 * `SentryModule`, used for integrating Sentry into the application.
 *
 * It uses `forRootAsync` to set up Sentry based on runtime configuration.
 *
 * - `useFactory`: An async function that receives a `ConfigService` instance
 *   to obtain configuration values and return the Sentry config.
 *   - `dsn`: Data Source Name for Sentry, retrieved from config service.
 *   - `environment`: Current environment (e.g., development, production),
 *     fetched from config service.
 *   - `enabled`: Indicates whether Sentry error tracking is enabled.
 *   - `logLevels`: If debugging is enabled, sets log level to 'debug';
 *     otherwise, it's not specified.
 * - `inject`: Specifies the `ConfigService` to be injected into the factory
 *   function.
 */
export const CoreInightsModule = SentryModule.forRootAsync({
  useFactory: async (configService: ConfigService) => {
    return {
      dsn: configService.getOrThrow('SENTRY_DSN'),
      environment: configService.getOrThrow('NODE_ENV'),
      enabled: configService.get<boolean>('SENTRY_ENABLED'),
      logLevels: configService.get<boolean>('SENTRY_DEBUG')
        ? ['debug']
        : undefined,
    };
  },
  inject: [ConfigService],
});
