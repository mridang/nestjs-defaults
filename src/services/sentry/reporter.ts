/**
 * Injection token for the active {@link SentryReporter}.
 */
export const SENTRY_REPORTER = Symbol('SENTRY_REPORTER');

/**
 * Severity levels shared by the Sentry SDKs.
 */
export type SentryLevel =
  | 'fatal'
  | 'error'
  | 'warning'
  | 'log'
  | 'info'
  | 'debug';

/**
 * A breadcrumb attached to subsequent Sentry events.
 */
export interface SentryBreadcrumb {
  /** The breadcrumb message. */
  message: string;
  /** The breadcrumb severity. */
  level: SentryLevel;
  /** Arbitrary structured data. */
  data?: Record<string, unknown>;
}

/**
 * The error-reporting surface the application uses, independent of which Sentry
 * SDK backs it.
 */
export interface SentryReporter {
  /**
   * Report an exception.
   *
   * @param error The error to report.
   * @returns The Sentry event id, when one was created.
   */
  captureException(error: unknown): string | undefined;

  /**
   * Report a message.
   *
   * @param message The message to report.
   * @param level The message severity.
   */
  captureMessage(message: string, level: SentryLevel): void;

  /**
   * Attach a breadcrumb to subsequent events.
   *
   * @param breadcrumb The breadcrumb to record.
   */
  addBreadcrumb(breadcrumb: SentryBreadcrumb): void;

  /**
   * Flush buffered events and close the client.
   *
   * @param timeout Maximum time to wait, in milliseconds.
   * @returns `true` when everything was flushed in time.
   */
  close(timeout?: number): Promise<boolean>;
}

/**
 * The subset of a Sentry SDK the reporter delegates to. Both `@sentry/node` and
 * `@sentry/cloudflare` expose exactly this.
 */
interface SentryApi {
  captureException(error: unknown): string;
  captureMessage(message: string, level: SentryLevel): string;
  addBreadcrumb(breadcrumb: SentryBreadcrumb): void;
  close(timeout?: number): Promise<boolean>;
}

/**
 * Reporter backed by a loaded Sentry SDK.
 *
 * `@sentry/node` and `@sentry/cloudflare` share the same capture API, so one
 * implementation serves both runtimes; only how each SDK is set up differs, and
 * that is handled by {@link createSentryReporter}.
 */
export class SdkSentryReporter implements SentryReporter {
  /**
   * @param sentry The loaded Sentry SDK.
   */
  constructor(private readonly sentry: SentryApi) {}

  captureException(error: unknown): string | undefined {
    return this.sentry.captureException(error);
  }

  captureMessage(message: string, level: SentryLevel): void {
    this.sentry.captureMessage(message, level);
  }

  addBreadcrumb(breadcrumb: SentryBreadcrumb): void {
    this.sentry.addBreadcrumb(breadcrumb);
  }

  close(timeout?: number): Promise<boolean> {
    return this.sentry.close(timeout);
  }
}

/**
 * Reporter that discards everything; used when Sentry is disabled or has no DSN.
 */
export class NoopSentryReporter implements SentryReporter {
  captureException(): string | undefined {
    return undefined;
  }

  captureMessage(): void {
    return undefined;
  }

  addBreadcrumb(): void {
    return undefined;
  }

  close(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

/**
 * `true` when executing inside a Cloudflare Workers isolate.
 */
const ON_CLOUDFLARE_WORKERS =
  typeof navigator !== 'undefined' &&
  navigator.userAgent === 'Cloudflare-Workers';

/**
 * Options for {@link createSentryReporter}.
 */
export interface SentryReporterOptions {
  /** The Sentry DSN. When absent, reporting is disabled. */
  dsn?: string;
  /** The deployment environment, e.g. `production`. */
  environment?: string;
  /** Set false to disable reporting even when a DSN is present. */
  enabled?: boolean;
  /** Whether the runtime is Cloudflare Workers. Defaults to detection. */
  onCloudflareWorkers?: boolean;
}

/**
 * A Node Sentry SDK: the capture surface plus an initialiser.
 */
type NodeSentryApi = SentryApi & {
  init(options: { dsn: string; environment?: string }): void;
};

/**
 * Loaders for the optional Sentry SDKs.
 *
 * The defaults import the real packages lazily; tests inject fakes so both
 * runtime branches are exercised without loading a runtime-specific SDK (the
 * Cloudflare package cannot be imported outside a Workers isolate).
 */
export interface SentrySdkLoaders {
  /** Load `@sentry/cloudflare`. */
  loadCloudflare(): Promise<SentryApi>;
  /** Load `@sentry/node`. */
  loadNode(): Promise<NodeSentryApi>;
}

/**
 * The default loaders, importing the real SDKs only when invoked.
 */
const DEFAULT_LOADERS: SentrySdkLoaders = {
  loadCloudflare: () =>
    import('@sentry/cloudflare') as unknown as Promise<SentryApi>,
  loadNode: () => import('@sentry/node') as unknown as Promise<NodeSentryApi>,
};

/**
 * Build the reporter for the active runtime.
 *
 * With no DSN, or when disabled, this returns a {@link NoopSentryReporter}. On
 * Cloudflare Workers it loads `@sentry/cloudflare` and relies on the worker
 * entry being wrapped with `Sentry.withSentry`; on Node it loads and
 * initialises `@sentry/node`. Both SDKs are optional and imported only when a
 * reporter is actually needed.
 *
 * @param options The reporter configuration.
 * @param loaders The SDK loaders; defaults to importing the real packages.
 * @returns The reporter for the active runtime.
 */
export async function createSentryReporter(
  options: SentryReporterOptions,
  loaders: SentrySdkLoaders = DEFAULT_LOADERS,
): Promise<SentryReporter> {
  if (!options.dsn || options.enabled === false) {
    return new NoopSentryReporter();
  }

  const onWorkers = options.onCloudflareWorkers ?? ON_CLOUDFLARE_WORKERS;
  if (onWorkers) {
    return new SdkSentryReporter(await loaders.loadCloudflare());
  }

  const sentry = await loaders.loadNode();
  sentry.init({ dsn: options.dsn, environment: options.environment });
  return new SdkSentryReporter(sentry);
}
