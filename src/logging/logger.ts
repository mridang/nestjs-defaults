/**
 * @file Nest logger that assembles Elastic Common Schema documents and hands them to a sink.
 */
import {
  Inject,
  Injectable,
  LoggerService,
  LogLevel,
  Optional,
} from '@nestjs/common';
import { isLogLevelEnabled } from '@nestjs/common/services/utils/is-log-level-enabled.util.js';
import { ClsService } from 'nestjs-cls';
import type { Ecs } from '@elastic/ecs';
import {
  ECS_VERSION,
  LOG_STRATEGY,
  selectStrategy,
  type LogStrategy,
} from './strategy.js';

/**
 * The `error` portion of an ECS document.
 */
type EcsErrorFields = NonNullable<Ecs['error']>;

/**
 * Maps each NestJS log level onto its Elastic Common Schema `log.level` value.
 */
const ECS_LEVELS: Record<LogLevel, string> = {
  log: 'info',
  error: 'error',
  warn: 'warn',
  debug: 'debug',
  verbose: 'trace',
  fatal: 'fatal',
};

/**
 * The NestJS log levels enabled by default.
 */
const DEFAULT_LEVELS: readonly LogLevel[] = [
  'log',
  'error',
  'warn',
  'debug',
  'verbose',
  'fatal',
];

/**
 * The `log.logger` value used when a call site supplies no context.
 */
const DEFAULT_CONTEXT = 'Application';

/**
 * A {@link LoggerService} that emits one Elastic Common Schema document per log
 * call.
 *
 * The logger knows nothing about how or where documents are written: it
 * assembles an ECS document from three sources — the strategy's static resource
 * fields, the request-scoped context held in CLS, and the fields of the call
 * itself — and hands it to the strategy's sink. The active {@link LogStrategy}
 * is chosen per runtime, which is what lets a single logger serve every
 * provider without any runtime-specific branching here.
 */
@Injectable()
export class BetterLogger implements LoggerService {
  /**
   * Creates the logger with its request context store, runtime strategy and enabled levels.
   * @param clsService - Request-scoped store holding the per-request ECS context.
   * @param strategy - The runtime's logging strategy; auto-selected when unbound.
   * @param logLevels - The enabled log levels; replaced by
   * {@link BetterLogger.setLogLevels}, which NestJS calls during bootstrap.
   * @example
   * ```ts
   * const logger = new BetterLogger(clsService, strategy);
   * logger.log('Server started', 'Bootstrap');
   * ```
   */
  constructor(
    private readonly clsService: ClsService,
    @Optional()
    @Inject(LOG_STRATEGY)
    private readonly strategy: LogStrategy = selectStrategy(),
    @Optional()
    private logLevels: LogLevel[] = [...DEFAULT_LEVELS],
  ) {}

  /**
   * Writes an entry at the `info` level, which Elastic Common Schema records as `log.level`.
   * @param message - The text or object to record.
   * @param optionalParams - A trailing context string and/or an `Error`.
   * @example
   * ```ts
   * logger.log('Order placed', 'OrdersService');
   * ```
   */
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  /**
   * Writes an entry at the `error` level.
   * @param message - The text or object to record.
   * @param optionalParams - A trailing context string and/or an `Error`.
   * @example
   * ```ts
   * logger.error('Payment failed', new Error('card declined'), 'Checkout');
   * ```
   */
  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  /**
   * Writes an entry at the `warn` level.
   * @param message - The text or object to record.
   * @param optionalParams - A trailing context string and/or an `Error`.
   * @example
   * ```ts
   * logger.warn('Cache is cold', 'CacheService');
   * ```
   */
  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  /**
   * Writes an entry at the `debug` level.
   * @param message - The text or object to record.
   * @param optionalParams - A trailing context string and/or an `Error`.
   * @example
   * ```ts
   * logger.debug({ attempt: 2 }, 'Retrying');
   * ```
   */
  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  /**
   * Writes an entry at the `verbose` level, which Elastic Common Schema records as `trace`.
   * @param message - The text or object to record.
   * @param optionalParams - A trailing context string and/or an `Error`.
   * @example
   * ```ts
   * logger.verbose('Cache lookup finished', 'CacheService');
   * ```
   */
  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  /**
   * Writes an entry at the `fatal` level.
   * @param message - The text or object to record.
   * @param optionalParams - A trailing context string and/or an `Error`.
   * @example
   * ```ts
   * logger.fatal(new Error('database unreachable'), 'Bootstrap');
   * ```
   */
  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  /**
   * Replaces the set of enabled log levels.
   * @param levels - The levels to enable from now on.
   * @example
   * ```ts
   * logger.setLogLevels(['error', 'warn']);
   * ```
   */
  setLogLevels(levels: LogLevel[]): void {
    this.logLevels = levels;
  }

  /**
   * Reports whether a level is currently enabled.
   * @param level - The level to test.
   * @returns `true` when the level is enabled.
   * @example
   * ```ts
   * logger.isLevelEnabled('debug'); // false when debug logging is off
   * ```
   */
  isLevelEnabled(level: LogLevel): boolean {
    return isLogLevelEnabled(level, this.logLevels);
  }

  /**
   * Assembles and emits one document, unless the level is disabled.
   * @param level - The NestJS level of the call.
   * @param message - The text or object to record.
   * @param optionalParams - The trailing parameters to interpret.
   * @example
   * ```ts
   * this.write('log', 'Started', ['Bootstrap']);
   * ```
   */
  private write(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }
    const { context, error } = this.interpret(optionalParams);
    this.strategy.sink.emit(this.buildEntry(level, message, context, error));
  }

  /**
   * Assembles a complete ECS document from the resource, request context, and
   * the fields of a single call.
   * @param level - The NestJS level of the call.
   * @param message - The text or object to record.
   * @param context - The originating logger context.
   * @param error - The shaped error, when one was supplied.
   * @returns The complete ECS document.
   * @example
   * ```ts
   * const doc = this.buildEntry('log', 'Started', 'Bootstrap');
   * ```
   */
  private buildEntry(
    level: LogLevel,
    message: unknown,
    context: string,
    error?: EcsErrorFields,
  ): Ecs {
    const requestContext =
      this.clsService.get<Partial<Ecs>>('ctx') ?? ({} as Partial<Ecs>);
    return {
      ...this.strategy.resource,
      ...requestContext,
      ecs: { version: ECS_VERSION },
      '@timestamp': new Date().toISOString(),
      message: typeof message === 'string' ? message : String(message),
      log: { level: ECS_LEVELS[level], logger: context },
      ...(error ? { error } : {}),
    };
  }

  /**
   * Pulls the optional context string and `Error` out of the trailing parameters.
   * @param optionalParams - The trailing parameters of a log call.
   * @returns The resolved context and shaped error.
   * @example
   * ```ts
   * this.interpret(['Checkout', new Error('x')]); // { context: 'Checkout', error: {...} }
   * ```
   */
  private interpret(optionalParams: unknown[]): {
    context: string;
    error?: EcsErrorFields;
  } {
    const error = optionalParams.find((param) => param instanceof Error);
    const rest = optionalParams.filter((param) => !(param instanceof Error));
    const last = rest.at(-1);
    return {
      context: typeof last === 'string' ? last : DEFAULT_CONTEXT,
      error: error instanceof Error ? this.toEcsError(error) : undefined,
    };
  }

  /**
   * Shapes a JavaScript `Error` into ECS `error.*` fields.
   * @param error - The error to shape.
   * @returns The ECS `error` fields.
   * @example
   * ```ts
   * this.toEcsError(new TypeError('bad input')); // { type: 'TypeError', message: 'bad input', ... }
   * ```
   */
  private toEcsError(error: Error): EcsErrorFields {
    const augmented = error as Error & { code?: string; id?: string };
    return {
      code: augmented.code,
      id: augmented.id,
      message: error.message,
      stack_trace: error.stack,
      type: error.name,
    };
  }
}
