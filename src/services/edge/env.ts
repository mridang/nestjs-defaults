/**
 * The Worker's bindings (`env`), or undefined when not running on Cloudflare
 * Workers (local development under Node, tests).
 */
export type WorkerEnv = Readonly<Record<string, unknown>>;

let cached: Promise<WorkerEnv | undefined> | undefined;

/** `cloudflare:workers` only resolves inside workerd, so it is imported lazily. */
export function workerEnv(): Promise<WorkerEnv | undefined> {
  cached ??= (import(`cloudflare:workers`) as Promise<{ env: WorkerEnv }>).then(
    (mod) => mod.env,
    () => undefined,
  );
  return cached;
}
