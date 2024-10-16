import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { VersionModule } from '../../../src/services/version/version.module';

describe('version.e2e test', () => {
  let testModule: NestExpressApplication;

  beforeAll(async () => {
    testModule = await Test.createTestingModule({
      imports: [VersionModule],
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

  test('that a bage is rendered when requested', () => {
    return request(testModule.getHttpServer())
      .get('/version.svg')
      .expect(HttpStatus.OK)
      .expect('Content-Type', 'image/svg+xml; charset=utf-8')
      .expect((response) => {
        expect(response.body.toString()).toMatch(/<svg.*?svg>/);
      });
  });
});
