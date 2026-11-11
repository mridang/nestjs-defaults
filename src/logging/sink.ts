/**
 * @file Sinks that write finished log documents to the console or to stdout.
 */
import type { Ecs } from '@elastic/ecs';

/**
 * A destination for fully-assembled ECS log documents.
 *
 * A sink is the single place that performs output. It receives a complete
 * {@link Ecs} document and writes it wherever the active runtime expects logs
 * to go. Keeping output behind this interface lets the logger stay free of any
 * knowledge about streams, `process`, or `console`, and lets each runtime pick
 * the mechanism it indexes best.
 */
export interface LogSink {
  /**
   * Emit one ECS document.
   * @param entry - The complete ECS log document to write.
   */
  emit(entry: Ecs): void;
}

/**
 * Sink that writes the ECS document as a structured object via `console.log`.
 *
 * This is the native logging path on Cloudflare Workers: Workers Observability
 * captures `console.log` arguments and indexes the object's fields directly, so
 * no serialisation is needed and no `node:stream` is involved (which is what
 * caused the spurious `STREAM:` debug output under the previous design).
 */
export class StructuredConsoleSink implements LogSink {
  /**
   * Writes the document as a structured object the platform can index.
   * @param entry - The complete ECS log document to write.
   * @example
   * ```ts
   * new StructuredConsoleSink().emit({ message: 'ready', '@timestamp': now });
   * ```
   */
  emit(entry: Ecs): void {
    console.log(entry);
  }
}

/**
 * Sink that writes the ECS document as a single JSON line to `process.stdout`.
 *
 * This is the path for Node-based runtimes (containers, FaaS) where a log
 * collector tails standard output and forwards structured JSON to a backend
 * such as an OpenTelemetry collector or Elasticsearch.
 */
export class StdoutJsonSink implements LogSink {
  /**
   * Writes the document as one newline-terminated JSON object.
   * @param entry - The complete ECS log document to write.
   * @example
   * ```ts
   * new StdoutJsonSink().emit({ message: 'ready', '@timestamp': now });
   * ```
   */
  emit(entry: Ecs): void {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }
}

/**
 * Sink that writes a compact, human-readable line via `console.log`.
 *
 * Intended for local development, where a queryable JSON document is less
 * useful than a glanceable one-liner. The full document is never discarded;
 * only the rendering differs.
 */
export class PrettyConsoleSink implements LogSink {
  /**
   * Renders `timestamp level [logger] message` and writes it to the console.
   * @param entry - The complete ECS log document to write.
   * @example
   * ```ts
   * new PrettyConsoleSink().emit({ message: 'ready', log: { level: 'info' } });
   * ```
   */
  emit(entry: Ecs): void {
    const level = (entry.log?.level ?? 'info').toUpperCase().padEnd(5);
    const logger = entry.log?.logger ?? 'Application';
    console.log(`${entry['@timestamp']} ${level} [${logger}] ${entry.message}`);
  }
}
