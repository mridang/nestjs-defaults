/**
 * @file Exception filter that turns thrown errors into safe, consistent HTTP responses.
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces/index.js';
import { Response } from 'express';
import { isObject } from '@nestjs/common/utils/shared.utils.js';
import showError from './error.js';

@Catch()
export class CustomHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CustomHttpExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    if (
      exception instanceof HttpException ||
      CustomHttpExceptionFilter.isHttpError(exception)
    ) {
      const status =
        exception instanceof HttpException
          ? exception.getStatus()
          : exception.statusCode;

      this.showError(status, host.switchToHttp());
    } else {
      this.logger.error('An error occurred', exception);
      this.showError(HttpStatus.INTERNAL_SERVER_ERROR, host.switchToHttp());
    }
  }

  private showError(status: number, ctx: HttpArgumentsHost) {
    if (ctx.getRequest().headers.accept?.includes('text/html')) {
      ctx.getResponse<Response>().status(status).send(showError(status));
    } else {
      ctx.getResponse<Response>().status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: ctx.getRequest().url,
      });
    }
  }

  /**
   * Tells whether a thrown value is an object carrying a message.
   * @param err - The thrown value, which may be of any shape.
   * @returns True when the value is an object with a non-empty message.
   * @example
   * ```ts
   * filter.isExceptionObject(new Error('boom')); // true
   * filter.isExceptionObject('boom'); // false
   * ```
   */
  public isExceptionObject(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- thrown values are untyped at runtime
    err: any,
  ): err is Error {
    return isObject(err) && !!(err as Error).message;
  }

  /**
   * Checks whether the thrown error comes from the "http-errors" library.
   * @param err - The thrown value, which may be of any shape.
   * @returns True when the value carries both a status code and a message.
   * @example
   * ```ts
   * CustomHttpExceptionFilter.isHttpError({ statusCode: 404, message: 'x' }); // true
   * ```
   */
  private static isHttpError(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- thrown values are untyped at runtime
    err: any,
  ): err is { statusCode: number; message: string } {
    return err?.statusCode && err?.message;
  }
}
