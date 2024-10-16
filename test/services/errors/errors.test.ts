import request from 'supertest';
import {
  Controller,
  Get,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { APP_FILTER } from '@nestjs/core';
import { CustomHttpExceptionFilter } from '../../../src/services/errors';

@Controller()
class DynamicController {
  @Get('/')
  getHtmlResponse(): string {
    throw new UnauthorizedException();
  }
}

describe('errors.e2e test', () => {
  let testModule: NestExpressApplication;

  beforeAll(async () => {
    testModule = await Test.createTestingModule({
      controllers: [DynamicController],
      providers: [
        {
          provide: APP_FILTER,
          useFactory: () => new CustomHttpExceptionFilter(),
        },
      ],
    })
      .compile()
      .then((module) =>
        module.createNestApplication<NestExpressApplication>({
          rawBody: true,
        }),
      )
      .then((nest) => nest.init());
  });

  afterAll(async () => {
    await testModule?.close();
  });

  test('that the filter does render an page when HTML is accepted', () => {
    return request(testModule.getHttpServer())
      .get('/')
      .set('Accept', 'text/html')
      .expect(HttpStatus.UNAUTHORIZED)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect((response) => {
        expect(response.text).toContain('<title>Unauthorized</title>');
      });
  });

  test('that the filter does not render an page when JSON is accepted', () => {
    return request(testModule.getHttpServer())
      .get('/')
      .set('Accept', 'application/json')
      .expect(HttpStatus.UNAUTHORIZED)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect((response) => {
        expect(response.text).toContain('"statusCode":401');
      });
  });
});
