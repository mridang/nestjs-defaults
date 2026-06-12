import {
  Inject,
  Injectable,
  LoggerService,
  LogLevel,
  Optional,
} from '@nestjs/common';
import { isLogLevelEnabled } from '@nestjs/common/services/utils';
import { ClsService } from 'nestjs-cls';
import type { Ecs } from '@elastic/ecs';
import {
  ECS_VERSION,
  LOG_STRATEGY,
  selectStrategy,
  type LogStrategy,
} from './strategy';

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
   * @param clsService Request-scoped store holding the per-request ECS context.
   * @param strategy The runtime's logging strategy; auto-selected when unbound.
   * @param logLevels The enabled log levels; mutated only by
   *   {@link BetterLogger.setLogLevels}, which NestJS calls during bootstrap.
   */
  constructor(
    private readonly clsService: ClsService,
    @Optional()
    @Inject(LOG_STRATEGY)
    private readonly strategy: LogStrategy = selectStrategy(),
    @Optional()
    private logLevels: LogLevel[] = [...DEFAULT_LEVELS],
  ) {
    //
  }

  /**
   * Write a log-level (`info`) entry.
   *
   * @param message The log message.
   * @param optionalParams A trailing context string and/or an `Error`.
   */
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  /**
   * Write an error-level entry.
   *
   * @param message The log message.
   * @param optionalParams A trailing context string and/or an `Error`.
   */
  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  /**
   * Write a warn-level entry.
   *
   * @param message The log message.
   * @param optionalParams A trailing context string and/or an `Error`.
   */
  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  /**
   * Write a debug-level entry.
   *
   * @param message The log message.
   * @param optionalParams A trailing context string and/or an `Error`.
   */
  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  /**
   * Write a verbose-level (`trace`) entry.
   *
   * @param message The log message.
   * @param optionalParams A trailing context string and/or an `Error`.
   */
  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  /**
   * Write a fatal-level entry.
   *
   * @param message The log message.
   * @param optionalParams A trailing context string and/or an `Error`.
   */
  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  /**
   * Replace the set of enabled log levels.
   *
   * @param levels The levels to enable.
   */
  setLogLevels(levels: LogLevel[]): void {
    this.logLevels = levels;
  }

  /**
   * Report whether a level is currently enabled.
   *
   * @param level The level to test.
   * @returns `true` when the level is enabled.
   */
  isLevelEnabled(level: LogLevel): boolean {
    return isLogLevelEnabled(level, this.logLevels);
  }

  /**
   * Assemble and emit one document, unless the level is disabled.
   *
   * @param level The NestJS level of the call.
   * @param message The log message.
   * @param optionalParams The trailing parameters to interpret.
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
   * Assemble a complete ECS document from the resource, request context, and
   * the fields of a single call.
   *
   * @param level The NestJS level of the call.
   * @param message The log message.
   * @param context The originating logger context.
   * @param error The shaped error, when one was supplied.
   * @returns The complete ECS document.
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
   * Pull the optional context string and `Error` out of the trailing params.
   *
   * @param optionalParams The trailing parameters of a log call.
   * @returns The resolved context and shaped error.
   */
  private interpret(optionalParams: unknown[]): {
    context: string;
    error?: EcsErrorFields;
  } {
    const error = optionalParams.find((param) => param instanceof Error);
    const rest = optionalParams.filter((param) => !(param instanceof Error));
    const last = rest[rest.length - 1];
    return {
      context: typeof last === 'string' ? last : DEFAULT_CONTEXT,
      error: error instanceof Error ? this.toEcsError(error) : undefined,
    };
  }

  /**
   * Shape a JavaScript `Error` into ECS `error.*` fields.
   *
   * @param error The error to shape.
   * @returns The ECS `error` fields.
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
