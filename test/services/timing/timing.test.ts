/**
 * @file Tests for the server timing decorator and interceptor, checking the Server-Timing header.
 */
import { setTimeout } from 'node:timers/promises';
import { afterAll, beforeAll, describe, test } from '@jest/globals';
import request from 'supertest';
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  TimingModule,
  ServerTiming,
} from '../../../src/services/timing/index.js';

/** Matches the timeit and App Total server-timing header. */
const TIMEIT_SERVER_TIMING_PATTERN =
  /^timeit;dur=\d+\.\d+, total;dur=\d+\.\d+;desc="App Total"$/u;

/** Matches the App Total server-timing header alone. */
const TOTAL_SERVER_TIMING_PATTERN = /^total;dur=0\.\d+;desc="App Total"$/u;

@Controller()
class DynamicController {
  @HttpCode(HttpStatus.NO_CONTENT)
  @Get('/decorated')
  async getSomeInvocation() {
    return this.doSomething();
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Get('/undecorated')
  async getAnotherInvocation() {}

  @HttpCode(HttpStatus.NO_CONTENT)
  @Get('/erroneous')
  async getErroredInvocation() {
    return this.throwUp();
  }

  @ServerTiming('timeit')
  throwUp() {
    throw new Error('Timed failure');
  }

  @ServerTiming('timeit')
  async doSomething(): Promise<void> {
    return setTimeout(1000);
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
      .then(async (nest) => nest.init());
  });

  afterAll(async () => {
    await testModule?.close();
  });

  test('that the timing results are returned when decorated', () =>
    request(testModule.getHttpServer())
      .get('/decorated')
      .expect(HttpStatus.NO_CONTENT)
      .expect('server-timing', TIMEIT_SERVER_TIMING_PATTERN));

  test('that the timing results are returned when not decorated', () =>
    request(testModule.getHttpServer())
      .get('/undecorated')
      .expect(HttpStatus.NO_CONTENT)
      .expect('server-timing', TOTAL_SERVER_TIMING_PATTERN));

  test('that the timing results are returned when upon errors', () =>
    request(testModule.getHttpServer())
      .get('/erroneous')
      .expect(HttpStatus.INTERNAL_SERVER_ERROR)
      .expect('server-timing', TIMEIT_SERVER_TIMING_PATTERN));
});
