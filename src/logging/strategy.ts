import type { Ecs } from '@elastic/ecs';
import os from 'node:os';
import {
  LogSink,
  PrettyConsoleSink,
  StdoutJsonSink,
  StructuredConsoleSink,
} from './sink.js';

/**
 * Injection token used to override the auto-selected {@link LogStrategy}.
 */
export const LOG_STRATEGY = Symbol('LOG_STRATEGY');

/**
 * The Elastic Common Schema version these documents conform to. Mirrors the
 * `@elastic/ecs` type package this project depends on.
 */
export const ECS_VERSION = '9.4.0';

/**
 * `true` when executing inside a Cloudflare Workers isolate.
 *
 * Workers expose a `navigator.userAgent` of `'Cloudflare-Workers'`, the
 * documented and stable way to detect the runtime.
 */
const ON_CLOUDFLARE_WORKERS =
  typeof navigator !== 'undefined' &&
  navigator.userAgent === 'Cloudflare-Workers';

/**
 * Minimal view of `node:os` used to describe a host. Declared as an interface
 * so tests can supply a deterministic implementation.
 */
export interface HostInfo {
  /** CPU architecture, e.g. `'x64'`. */
  arch(): string;
  /** Host name of the operating system. */
  hostname(): string;
  /** Operating system name, e.g. `'Linux'`. */
  type(): string;
  /** Operating system release, e.g. `'6.1.0'`. */
  release(): string;
  /** Operating system platform, e.g. `'linux'`. */
  platform(): string;
  /** Operating system version string. */
  version(): string;
}

/**
 * A complete logging strategy for one runtime: the static resource-level fields
 * that describe the service, and the sink that performs output.
 *
 * Strategies are the per-provider seam. Each runtime maps its own facts into
 * the same ECS shape and chooses how documents are emitted, so the logger
 * itself stays runtime-agnostic.
 */
export interface LogStrategy {
  /** Resource-level ECS fields shared by every document this process emits. */
  readonly resource: Partial<Ecs>;
  /** The destination documents are written to. */
  readonly sink: LogSink;
}

/**
 * Build the `service` fields common to every runtime from the environment.
 *
 * @param env The process environment to read service identity from.
 * @returns The `service` portion of an ECS document.
 */
function buildService(
  env: Readonly<Record<string, string | undefined>>,
): Partial<Ecs> {
  return {
    service: {
      name: env.SERVICE_NAME,
      version: env.SERVICE_VERSION,
      environment: env.NODE_ENV,
      id: env.SERVICE_ID,
      type: env.SERVICE_TYPE,
    },
  };
}

/**
 * Build the resource for a Cloudflare Workers isolate.
 *
 * A Worker has no host, so `host.*` is omitted entirely rather than filled with
 * the misleading placeholder values the `node:os` polyfill returns. Per-request
 * geography (`cloud.region` from the serving colo) is added by the request
 * middleware, not here.
 *
 * @param env The process environment to read service identity from.
 * @returns The resource-level ECS fields for a Worker.
 */
function buildCloudflareResource(
  env: Readonly<Record<string, string | undefined>>,
): Partial<Ecs> {
  return {
    ...buildService(env),
    cloud: {
      provider: 'cloudflare',
      service: { name: 'workers' },
    },
  };
}

/**
 * Build the resource for a Node-based runtime (containers, FaaS).
 *
 * The host is real here, so `host.*` (including `host.os.*`) is populated, and
 * cloud metadata is read from the provider-neutral `CLOUD_*` environment
 * variables the deployment sets.
 *
 * @param env The process environment to read identity and cloud metadata from.
 * @param host The host information source.
 * @returns The resource-level ECS fields for a Node runtime.
 */
function buildNodeResource(
  env: Readonly<Record<string, string | undefined>>,
  host: HostInfo,
): Partial<Ecs> {
  return {
    ...buildService(env),
    host: {
      architecture: host.arch(),
      hostname: host.hostname(),
      name: host.hostname(),
      os: {
        name: host.type(),
        family: host.type(),
        full: `${host.type()} ${host.release()}`.trim(),
        kernel: host.release(),
        platform: host.platform(),
        version: host.version(),
      },
    },
    cloud: {
      provider: env.CLOUD_PROVIDER,
      region: env.CLOUD_REGION,
      availability_zone: env.CLOUD_AVAILABILITY_ZONE,
      account: { id: env.CLOUD_ACCOUNT_ID, name: env.CLOUD_ACCOUNT_NAME },
      instance: { id: env.CLOUD_INSTANCE_ID, name: env.CLOUD_INSTANCE_NAME },
      machine: { type: env.CLOUD_MACHINE_TYPE },
      service: { name: env.CLOUD_SERVICE_NAME },
    },
  };
}

/**
 * Options for {@link selectStrategy}.
 */
export interface SelectStrategyOptions {
  /** Process environment to read configuration from. Defaults to `process.env`. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Host information source for Node runtimes. Defaults to `node:os`. */
  host?: HostInfo;
  /** Whether the current runtime is Cloudflare Workers. Defaults to detection. */
  onCloudflareWorkers?: boolean;
}

/**
 * Choose the logging strategy for the active runtime.
 *
 * Selection is by capability, never by cloud-provider name: a Worker logs
 * structured objects to `console`; a production Node process writes JSON lines
 * to stdout; any other Node process gets a human-readable line.
 *
 * @param options Overrides for environment, host, and runtime detection.
 * @returns The strategy to log with.
 */
export function selectStrategy(
  options: SelectStrategyOptions = {},
): LogStrategy {
  const env = options.env ?? process.env;
  const host = options.host ?? os;
  const onWorkers = options.onCloudflareWorkers ?? ON_CLOUDFLARE_WORKERS;

  if (onWorkers) {
    return {
      resource: buildCloudflareResource(env),
      sink: new StructuredConsoleSink(),
    };
  }

  const sink: LogSink =
    env.NODE_ENV === 'production'
      ? new StdoutJsonSink()
      : new PrettyConsoleSink();

  return {
    resource: buildNodeResource(env, host),
    sink,
  };
}
