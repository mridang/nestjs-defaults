import { DynamicModule } from '@nestjs/common';
import { SentryModule } from './sentry';

/**
 * Build the Sentry insights module.
 *
 * The module reads `SENTRY_DSN` from configuration and selects a reporter for
 * the active runtime. With no DSN the reporter is a no-op, so this is safe to
 * include on runtimes where Sentry is not configured.
 *
 * @returns The Sentry insights module.
 */
export function createInsightsModule(): DynamicModule {
  return SentryModule.forRoot();
}
