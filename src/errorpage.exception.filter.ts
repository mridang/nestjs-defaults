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
import * as fs from 'fs';
import * as path from 'path';
import { isObject } from '@nestjs/common/utils/shared.utils';

@Catch()
export class CustomHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CustomHttpExceptionFilter.name);
  private readonly basePath: string;

  constructor() {
    this.logger.log(
      `Looking for error pages ${path.join(__dirname, '..', 'views', 'errors')}`,
    );
    if (
      fs.existsSync(path.join(__dirname, '..', 'views', 'errors', `500.html`))
    ) {
      this.basePath = path.join(__dirname, '..', 'views', 'errors');
    } else {
      this.logger.log(
        `Looking for error pages ${path.join(__dirname, 'views', 'errors')}`,
      );
      if (fs.existsSync(path.join(__dirname, 'views', 'errors', `500.html`))) {
        this.basePath = path.join(__dirname, 'views', 'errors');
      } else {
        throw new Error('Unable to find directory containing error pages');
      }
    }
  }
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
      const filePath = path.join(this.basePath, `${status}.html`);
      if (fs.existsSync(filePath)) {
        ctx.getResponse<Response>().status(status).sendFile(filePath);
      } else {
        throw new Error(
          `Error page not found for status code: ${status}, serving JSON error response instead.`,
        );
      }
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
