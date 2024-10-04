import { SentryModule } from './../../../../src/services/sentry/sentry.module';
import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';

describe('nel.controller test', () => {
  let testModule: NestExpressApplication;

  beforeAll(async () => {
    testModule = await Test.createTestingModule({
      imports: [
        SentryModule.forRoot({
          dsn: 'https://client@account.ingest.us.sentry.io/0',
        }),
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

  test('that nel reports are handled and sent to sentry', () => {
    return request(testModule.getHttpServer())
      .post('/report')
      .send([
        {
          age: 29662,
          body: {
            elapsed_time: 305,
            method: 'GET',
            phase: 'application',
            protocol: 'h3',
            referrer: '',
            sampling_fraction: 1,
            server_ip: '2606:4700:3033::6815:487c',
            status_code: 404,
            type: 'http.error',
          },
          type: 'network-error',
          url: 'https://local.mrida.ng/static/js/tadddilwind.3.4.5.js',
          user_agent: 'Mozilla/5.0',
        },
      ])
      .expect(HttpStatus.NO_CONTENT)
      .expect('Reporting-Endpoints', 'nel-endpoint="/report"')
      .expect(
        'nel',
        '{"report_to":"nel-endpoint","max_age":10886400,"include_subdomains":true,"success_fraction":0,"failure_fraction":1}',
      )
      .expect('');
  });
});
