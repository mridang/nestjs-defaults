import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { Response } from 'express';
import { isObject } from '@nestjs/common/utils/shared.utils';
import showError from './error';

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

  /* eslint-disable @typescript-eslint/no-explicit-any */
  public isExceptionObject(err: any): err is Error {
    return isObject(err) && !!(err as Error).message;
  }

  /**
   * Checks if the thrown error comes from the "http-errors" library.
   * @param err error object
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private static isHttpError(
    err: any,
  ): err is { statusCode: number; message: string } {
    return err?.statusCode && err?.message;
  }
}
