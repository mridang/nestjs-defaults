import { Injectable, LoggerService, LogLevel, Optional } from '@nestjs/common';
import winston, { createLogger, format, transports } from 'winston';
import { ClsService } from 'nestjs-cls';
import { isLogLevelEnabled } from '@nestjs/common/services/utils';
import { flatten } from 'safe-flat';
import os from 'node:os';
import * as Transport from 'winston-transport';

/**
 * `true` when the code is executing inside a Cloudflare Workers isolate.
 *
 * Workers expose a `navigator.userAgent` of `'Cloudflare-Workers'`, which is
 * the documented, stable way to detect the runtime. It is used to choose a
 * logging transport that does not depend on a writable `process.stdout`.
 */
const isCloudflareWorkers =
  typeof navigator !== 'undefined' &&
  navigator.userAgent === 'Cloudflare-Workers';

/**
 * Winston's internal symbols for the fully-formatted line and the level. The
 * format chain stamps the finished string onto `info[MESSAGE]`; these mirror
 * `triple-beam`'s exports (both are `Symbol.for(...)` globals) without adding a
 * dependency on it.
 */
const MESSAGE = Symbol.for('message');
const LEVEL = Symbol.for('level');

@Injectable()
export class BetterLogger implements LoggerService {
  private logger: winston.Logger;

  constructor(
    private readonly clsService: ClsService,
    @Optional()
    private logLevels: LogLevel[] = [
      'log',
      'error',
      'warn',
      'debug',
      'verbose',
      'fatal',
    ],
    @Optional()
    private readonly envVars = process.env,
    @Optional()
    private readonly nodeOs: {
      type(): string;
      arch(): string;
      hostname(): string;
      platform(): string;
      version(): string;
      release(): string;
    } = os,
    @Optional()
    private readonly winstonTransports: Transport[] | Transport = [
      new transports.Console(),
    ],
    @Optional()
    private readonly onCloudflareWorkers: boolean = isCloudflareWorkers,
  ) {
    const logFormat =
      envVars.AWS_LAMBDA_FUNCTION_NAME || envVars.NODE_ENV === 'production'
        ? format.combine(
            format((info) => {
              const ctx: object = this.clsService.get('ctx') || {};

              const fields = flatten({
                log: {
                  level: info.level,
                  logger: info.context,
                },
                message: info.message,
                ['@timestamp']: new Date(),
                ...ctx,
              }) as { [key: string]: unknown };

              delete fields.extras;
              delete info.extras;

              return {
                ...info,
                ...fields,
              };
            })(),
            format.json({ space: 0 }),
          )
        : format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            format.colorize({ all: true }),
            format.printf(({ timestamp, message, context }) => {
              return `${timestamp} ${context}: ${message}`;
            }),
          );

    const defaultMeta = flatten({
      service: {
        environment: envVars.NODE_ENV,
        id: envVars.SERVICE_ID,
        name: envVars.SERVICE_NAME || envVars.AWS_LAMBDA_FUNCTION_NAME,
        type: envVars.SERVICE_TYPE,
        version: envVars.SERVICE_VERSION || envVars.AWS_LAMBDA_FUNCTION_VERSION,
      },
      os: {
        architecture: nodeOs.arch(),
        hostname: nodeOs.hostname(),
        id: nodeOs.hostname(),
        ip: undefined,
        name: nodeOs.hostname(),
        os: {
          family: nodeOs.type(),
          full: `${nodeOs.type()} ${nodeOs.release()}`,
          kernel: nodeOs.release(),
          name: nodeOs.type(),
          platform: nodeOs.platform(),
          type: nodeOs.type().toLowerCase(),
          version: nodeOs.version(),
        },
        type: 'unknown',
      },
      cloud: {
        account: {
          id: process.env.CLOUD_ACCOUNT_ID,
          name: process.env.CLOUD_ACCOUNT_NAME,
        },
        availability_zone: process.env.CLOUD_AVAILABILITY_ZONE,
        instance: {
          id: process.env.CLOUD_INSTANCE_ID,
          name: process.env.CLOUD_INSTANCE_NAME,
        },
        machine: {
          type: process.env.CLOUD_MACHINE_TYPE,
        },
        provider: process.env.CLOUD_PROVIDER,
        region: process.env.CLOUD_REGION || process.env.AWS_REGION,
        service: {
          name: process.env.CLOUD_SERVICE_NAME,
        },
        origin: undefined,
        target: undefined,
      },
    });

    if (this.onCloudflareWorkers) {
      this.logger = this.createWorkersLogger(logFormat, defaultMeta);
    } else {
      this.logger = createLogger({
        level: 'debug',
        format: logFormat,
        defaultMeta,
        transports: this.winstonTransports,
      });
    }
  }

  /**
   * Build a logger for Cloudflare Workers that does not touch `node:stream`.
   *
   * The Workers runtime polyfills `node:stream` with a build whose internal
   * debug logging cannot be turned off, so Winston's stream-based delivery
   * prints a burst of `STREAM: ...` plumbing lines around every entry. This
   * runs the same Winston format chain in memory — the exact call Winston
   * makes internally, `format.transform(info, options)` — and emits the
   * finished line through `console.log`, the native Workers logging primitive.
   * No stream is created, so no debug plumbing is printed.
   *
   * @param logFormat The combined Winston format applied to each entry.
   * @param defaultMeta The base metadata merged into every entry.
   * @returns An object exposing the `winston.Logger` level methods used here.
   */
  private createWorkersLogger(
    logFormat: ReturnType<typeof format.combine>,
    defaultMeta: object,
  ): winston.Logger {
    const emit = (level: string, message: string, meta: object): void => {
      const info = {
        level,
        [LEVEL]: level,
        message,
        ...defaultMeta,
        ...meta,
      } as Parameters<typeof logFormat.transform>[0];

      const formatted = logFormat.transform(info, logFormat.options);
      if (formatted) {
        console.log((formatted as Record<symbol, string>)[MESSAGE]);
      }
    };

    const channel = (level: string) => {
      return (message: string, meta: object = {}): void => {
        emit(level, message, meta);
      };
    };

    return {
      info: channel('info'),
      error: channel('error'),
      warn: channel('warn'),
      debug: channel('debug'),
      verbose: channel('verbose'),
      crit: channel('crit'),
    } as unknown as winston.Logger;
  }

  /**
   * Write a 'log' level log, if the configured level allows for it.
   * Prints to `stdout` with newline.
   */
  log(message: string, context?: string): void;
  log(message: string, ...optionalParams: [...never, string?]): void;
  log(message: string, ...optionalParams: unknown[]) {
    if (!this.isLevelEnabled('log')) {
      return;
    }
    const { context, extras } = this.getContextAndMessagesToPrint(
      optionalParams.filter((param) => !(param instanceof Error)),
    );

    const error = optionalParams.find(
      (param) => param instanceof Error,
    ) as Error & { code?: string; id?: string };

    this.logger.info(message as string, {
      context,
      extras,
      error: error
        ? {
            code: error.code,
            id: error.id,
            message: error.message,
            stack_trace: error.stack,
            type: error.name,
          }
        : undefined,
    });
  }

  /**
   * Write an 'error' level log, if the configured level allows for it.
   * Prints to `stderr` with newline.
   */
  error(message: never, stackOrContext?: string): void;
  error(message: never, stack?: string, context?: string): void;
  error(message: never, ...optionalParams: [...never, string?, string?]): void;
  error(message: never, ...optionalParams: unknown[]) {
    if (!this.isLevelEnabled('error')) {
      return;
    }
    const { context, extras } = this.getContextAndMessagesToPrint(
      optionalParams.filter((param) => !(param instanceof Error)),
    );

    const error = optionalParams.find(
      (param) => param instanceof Error,
    ) as Error & { code?: string; id?: string };

    this.logger.error(message as string, {
      context,
      extras,
      error: error
        ? {
            code: error.code,
            id: error.id,
            message: error.message,
            stack_trace: error.stack,
            type: error.name,
          }
        : undefined,
    });

    if (!this.envVars.AWS_LAMBDA_FUNCTION_NAME) {
      console.error(error);
    }
  }

  /**
   * Write a 'warn' level log, if the configured level allows for it.
   * Prints to `stdout` with newline.
   */
  warn(message: never, context?: string): void;
  warn(message: never, ...optionalParams: [...never, string?]): void;
  warn(message: never, ...optionalParams: unknown[]) {
    if (!this.isLevelEnabled('warn')) {
      return;
    }
    const { context, extras } = this.getContextAndMessagesToPrint(
      optionalParams.filter((param) => !(param instanceof Error)),
    );

    const error = optionalParams.find(
      (param) => param instanceof Error,
    ) as Error & { code?: string; id?: string };

    this.logger.warn(message as string, {
      context,
      extras,
      error: error
        ? {
            code: error.code,
            id: error.id,
            message: error.message,
            stack_trace: error.stack,
            type: error.name,
          }
        : undefined,
    });

    if (!this.envVars.AWS_LAMBDA_FUNCTION_NAME) {
      console.warn(error);
    }
  }

  /**
   * Write a 'debug' level log, if the configured level allows for it.
   * Prints to `stdout` with newline.
   */
  debug(message: never, context?: string): void;
  debug(message: never, ...optionalParams: [...never, string?]): void;
  debug(message: never, ...optionalParams: unknown[]) {
    if (!this.isLevelEnabled('debug')) {
      return;
    }
    const { context, extras } = this.getContextAndMessagesToPrint(
      optionalParams.filter((param) => !(param instanceof Error)),
    );

    const error = optionalParams.find(
      (param) => param instanceof Error,
    ) as Error & { code?: string; id?: string };

    this.logger.debug(message as string, {
      context,
      extras,
      error: error
        ? {
            code: error.code,
            id: error.id,
            message: error.message,
            stack_trace: error.stack,
            type: error.name,
          }
        : undefined,
    });
  }

  /**
   * Write a 'verbose' level log, if the configured level allows for it.
   * Prints to `stdout` with newline.
   */
  verbose(message: never, context?: string): void;
  verbose(message: never, ...optionalParams: [...never, string?]): void;
  verbose(message: never, ...optionalParams: unknown[]) {
    if (!this.isLevelEnabled('verbose')) {
      return;
    }
    const { context, extras } = this.getContextAndMessagesToPrint(
      optionalParams.filter((param) => !(param instanceof Error)),
    );

    const error = optionalParams.find(
      (param) => param instanceof Error,
    ) as Error & { code?: string; id?: string };

    this.logger.verbose(message as string, {
      context,
      extras,
      error: error
        ? {
            code: error.code,
            id: error.id,
            message: error.message,
            stack_trace: error.stack,
            type: error.name,
          }
        : undefined,
    });
  }

  /**
   * Write a 'fatal' level log, if the configured level allows for it.
   * Prints to `stdout` with newline.
   */
  fatal(message: never, context?: string): void;
  fatal(message: never, ...optionalParams: [...never, string?]): void;
  fatal(message: never, ...optionalParams: unknown[]) {
    if (!this.isLevelEnabled('fatal')) {
      return;
    }
    const { context, extras } = this.getContextAndMessagesToPrint(
      optionalParams.filter((param) => !(param instanceof Error)),
    );

    const error = optionalParams.find(
      (param) => param instanceof Error,
    ) as Error & { code?: string; id?: string };

    this.logger.crit(message as string, {
      context,
      extras,
      error: error
        ? {
            code: error.code,
            id: error.id,
            message: error.message,
            stack_trace: error.stack,
            type: error.name,
          }
        : undefined,
    });

    if (!this.envVars.AWS_LAMBDA_FUNCTION_NAME) {
      console.error(error);
    }
  }

  /**
   * Set log levels
   * @param levels log levels
   */
  setLogLevels(levels: LogLevel[]) {
    this.logLevels = levels;
  }

  isLevelEnabled(level: LogLevel): boolean {
    return isLogLevelEnabled(level, this.logLevels);
  }

  private getContextAndMessagesToPrint(args: unknown[]): {
    context: string;
    extras: unknown[] | undefined;
  } {
    if (args?.length >= 1) {
      if (typeof args[args.length - 1] === 'string') {
        return {
          context: args[args.length - 1] as string,
          extras: args.length > 1 ? args.slice(0, -1) : undefined,
        };
      } else {
        return {
          context: 'Unknown',
          extras: args,
        };
      }
    } else {
      return {
        context: 'Unknown',
        extras: undefined,
      };
    }
  }
}
