import { SENTRY_MODULE_OPTIONS, SENTRY_TOKEN } from './sentry.constants';
import { makeInjectableDecorator } from './utils';

export const InjectSentry = makeInjectableDecorator(SENTRY_TOKEN);

/**
 * Injects the Sentry Module config
 */
export const InjectSentryModuleConfig = makeInjectableDecorator(
  SENTRY_MODULE_OPTIONS,
);
