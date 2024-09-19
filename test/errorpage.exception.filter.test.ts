import { expect } from '@jest/globals';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { CustomHttpExceptionFilter } from '../src/errorpage.exception.filter';

describe('CustomHttpExceptionFilter without mocks', () => {
  let filter: CustomHttpExceptionFilter;

  beforeAll(() => {
    filter = new CustomHttpExceptionFilter();
  });

  test('should send a HTML response when text/html is accepted', () => {
    // noinspection JSUnusedGlobalSymbols
    const response = {
      status: function (statusCode: number) {
        expect(statusCode).toBe(HttpStatus.NOT_FOUND);
        return this;
      },
      json: function () {
        fail();
      },
      sendFile: function (errorFile: string) {
        expect(errorFile).toContain('404.html');
      },
    };

    // noinspection JSUnusedGlobalSymbols
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({
          headers: { accept: 'text/html' },
          url: '/test',
        }),
      }),
    };

    filter.catch(
      new HttpException('Not Found', HttpStatus.NOT_FOUND),
      host as ArgumentsHost,
    );
  });

  test('should send a JSON response when text/html is not accepted', () => {
    // noinspection JSUnusedGlobalSymbols
    const response = {
      status: function (statusCode: number) {
        expect(statusCode).toBe(HttpStatus.NOT_FOUND);
        return this;
      },
      json: function (jsonError: object) {
        expect(jsonError).toMatchObject({
          statusCode: HttpStatus.NOT_FOUND,
          path: '/test',
        });
      },
      sendFile: function () {
        fail();
      },
    };

    // noinspection JSUnusedGlobalSymbols
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({
          headers: { accept: 'application/json' },
          url: '/test',
        }),
      }),
    };

    filter.catch(
      new HttpException('Not Found', HttpStatus.NOT_FOUND),
      host as ArgumentsHost,
    );
  });
});
