/**
 * Structured ECS logging: a runtime-agnostic logger that assembles Elastic
 * Common Schema documents and writes them through a per-runtime sink.
 */
export { BetterLogger } from './logger.js';
export {
  LOG_STRATEGY,
  selectStrategy,
  type LogStrategy,
  type HostInfo,
  type SelectStrategyOptions,
} from './strategy.js';
export {
  StructuredConsoleSink,
  StdoutJsonSink,
  PrettyConsoleSink,
  type LogSink,
} from './sink.js';
