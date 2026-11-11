/**
 * @file Reads and validates the edge runtime environment variables used by the defaults.
 */

/**
 * The Worker's bindings (`env`), or undefined when not running on Cloudflare
 * Workers (local development under Node, tests).
 */
export type WorkerEnv = Readonly<Record<string, unknown>>;

let cached: Promise<WorkerEnv | undefined> | undefined;

/**
 * Resolves the Worker's `env` bindings, which only exist inside the Workers runtime.
 *
 * `cloudflare:workers` only resolves inside workerd, so it is imported lazily and
 * the result is cached for later calls.
 * @returns A promise of the bindings, or undefined outside Cloudflare Workers.
 * @example
 * ```ts
 * const env = await workerEnv();
 * const dsn = env?.SENTRY_DSN;
 * ```
 */
export function workerEnv(): Promise<WorkerEnv | undefined> {
  cached ??= (import(`cloudflare:workers`) as Promise<{ env: WorkerEnv }>)
    .then((mod) => mod.env)
    .catch(() => undefined);
  return cached;
}
