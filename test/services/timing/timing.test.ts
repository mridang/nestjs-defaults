import request from 'supertest';
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { TimingModule, ServerTiming } from './../../../src/services/timing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { setTimeout as sleep } from 'node:timers/promises';

@Controller()
class DynamicController {
  @HttpCode(HttpStatus.NO_CONTENT)
  @Get('/decorated')
  async getSomeInvocation() {
    return await this.doSomething();
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Get('/undecorated')
  async getAnotherInvocation() {
    return;
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Get('/erroneous')
  async getErroredInvocation() {
    return this.throwUp();
  }

  @ServerTiming('timeit')
  throwUp() {
    throw new Error();
  }

  @ServerTiming('timeit')
  doSomething(): Promise<void> {
    return sleep(1000);
  }
}

describe('timing.e2e test', () => {
  let testModule: NestExpressApplication;

  beforeAll(async () => {
    testModule = await Test.createTestingModule({
      imports: [TimingModule],
      controllers: [DynamicController],
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

  test('that the timing results are returned when decorated', () => {
    return request(testModule.getHttpServer())
      .get('/decorated')
      .expect(HttpStatus.NO_CONTENT)
      .expect(
        'server-timing',
        /^timeit;dur=\d+\.\d+, total;dur=\d+\.\d+;desc="App Total"$/,
      );
  });

  test('that the timing results are returned when not decorated', () => {
    return request(testModule.getHttpServer())
      .get('/undecorated')
      .expect(HttpStatus.NO_CONTENT)
      .expect('server-timing', /^total;dur=0\.\d+;desc="App Total"$/);
  });

  test('that the timing results are returned when upon errors', () => {
    return request(testModule.getHttpServer())
      .get('/erroneous')
      .expect(HttpStatus.INTERNAL_SERVER_ERROR)
      .expect(
        'server-timing',
        /^timeit;dur=\d+\.\d+, total;dur=\d+\.\d+;desc="App Total"$/,
      );
  });
});
