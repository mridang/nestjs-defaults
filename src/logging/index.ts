/**
 * Structured ECS logging: a runtime-agnostic logger that assembles Elastic
 * Common Schema documents and writes them through a per-runtime sink.
 */
export { BetterLogger } from './logger';
export {
  LOG_STRATEGY,
  selectStrategy,
  type LogStrategy,
  type HostInfo,
  type SelectStrategyOptions,
} from './strategy';
export {
  StructuredConsoleSink,
  StdoutJsonSink,
  PrettyConsoleSink,
  type LogSink,
} from './sink';
