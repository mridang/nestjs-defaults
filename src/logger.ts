import { Injectable, LoggerService, LogLevel, Optional } from '@nestjs/common';
import winston, { createLogger, format, transports } from 'winston';
import { ClsService } from 'nestjs-cls';
import { isLogLevelEnabled } from '@nestjs/common/services/utils';
import { flatten } from 'safe-flat';
import os from 'node:os';
import { Writable } from 'node:stream';
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
 * Build a Winston transport that is safe to use on Cloudflare Workers.
 *
 * On Workers the `process.stdout` stream provided by `nodejs_compat` has no
 * working `_write()` implementation, so Winston's built-in
 * {@link transports.Console} throws `ERR_METHOD_NOT_IMPLEMENTED` the first time
 * anything is logged. This transport instead writes to a small
 * {@link Writable} whose `_write()` forwards every formatted line to
 * `console.log`, which is implemented natively on Workers. The format pipeline
 * is unchanged, so the emitted lines are identical to the Node transport's.
 *
 * @returns A stream transport that emits formatted log lines via `console.log`.
 */
function createConsoleTransport(): Transport {
  const consoleStream = new Writable({
    // Parameter types are inferred from `WritableOptions.write`, so the encoding
    // argument keeps its `BufferEncoding` type without naming that global (which
    // the lint config's `no-undef` rule would otherwise flag).
    write(chunk, _encoding, next): void {
      console.log(String(chunk).replace(/\n$/, ''));
      next();
    },
  });

  return new transports.Stream({ stream: consoleStream });
}

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
      isCloudflareWorkers ? createConsoleTransport() : new transports.Console(),
    ],
  ) {
    this.logger = createLogger({
      level: 'debug',
      format:
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
            ),
      defaultMeta: flatten({
        service: {
          environment: envVars.NODE_ENV,
          id: envVars.SERVICE_ID,
          name: envVars.SERVICE_NAME || envVars.AWS_LAMBDA_FUNCTION_NAME,
          type: envVars.SERVICE_TYPE,
          version:
            envVars.SERVICE_VERSION || envVars.AWS_LAMBDA_FUNCTION_VERSION,
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
      }),
      transports: this.winstonTransports,
    });
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
