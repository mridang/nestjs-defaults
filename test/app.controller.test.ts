import { expect } from '@jest/globals';
import { End2EndModule } from './e2e.module';
import { DefaultsModule } from '../src/defaults.module';
import request from 'supertest';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  InternalServerErrorException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { ClsService } from 'nestjs-cls';

class TestDTO {
  @IsNotEmpty()
  @IsEmail()
  email?: string;

  @IsNotEmpty()
  message?: string;
}

@Controller()
class DynamicController {
  constructor(private readonly clsService: ClsService) {
    //
  }

  @Get('500')
  get500() {
    throw new Error('500 error');
  }

  @Get('error')
  getError() {
    throw new InternalServerErrorException('General error');
  }

  @Get('set-cookie')
  setCookie(@Res({ passthrough: true }) res: Response) {
    res.cookie('test', 'NestJS');
    return 'Okie';
  }

  @Get('read-cookie')
  readCookie(@Req() req: Request) {
    return req.cookies['test'] || 'No cookie found';
  }

  @Post('validate')
  validateTest(@Body() testDto: TestDTO) {
    return testDto;
  }

  @Get('cls-ctx')
  getClsCtx() {
    return this.clsService.get('ctx') || {};
  }
}

const testModule = new End2EndModule({
  imports: [
    DefaultsModule.register({
      configName: 'moo',
    }),
    {
      module: DefaultsModule,
      controllers: [DynamicController],
      providers: [],
    },
  ],
});

describe('app.controller test', () => {
  beforeAll(async () => {
    await testModule.beforeAll();
  });

  afterAll(async () => {
    await testModule.afterAll();
  });

  test('that the health-check endpoint is operational', () => {
    return request(testModule.app.getHttpServer())
      .get('/health')
      .expect(HttpStatus.NO_CONTENT)
      .expect('');
  });

  test('that the error-handler handles http-400 errors', async () => {
    await request(testModule.app.getHttpServer())
      .get('/404')
      .set('Accept', 'text/html')
      .expect(HttpStatus.NOT_FOUND)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect((response) => {
        if (!response.text.includes('<title>Not Found</title>')) {
          throw new Error('Expected text not found in response');
        }
      });
  });

  test('that the error-handler handles http-500 errors', async () => {
    await request(testModule.app.getHttpServer())
      .get('/500')
      .set('Accept', 'text/html')
      .expect(HttpStatus.INTERNAL_SERVER_ERROR)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect('x-exception-id', /^.*?$/)
      .expect((response) => {
        if (!response.text.includes('<title>Internal Server Error</title>')) {
          throw new Error('Expected text not found in response');
        }
      });
  });

  test('that the error-handler handles non-http errors', async () => {
    await request(testModule.app.getHttpServer())
      .get('/error')
      .set('Accept', 'text/html')
      .expect(HttpStatus.INTERNAL_SERVER_ERROR)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect('x-exception-id', /^.*?$/)
      .expect((response) => {
        if (!response.text.includes('<title>Internal Server Error</title>')) {
          throw new Error('Expected text not found in response');
        }
      });
  });

  test('the application is configured to process cookies', async () => {
    await request(testModule.app.getHttpServer())
      .get('/set-cookie')
      .expect(HttpStatus.OK)
      .expect('set-cookie', /.*test=NestJS.*/);

    await request(testModule.app.getHttpServer())
      .get('/read-cookie')
      .set('Cookie', [`test=NestJS`])
      .expect(HttpStatus.OK)
      .expect('NestJS');
  });

  test('that the application returns the security headers', async () => {
    await request(testModule.app.getHttpServer())
      .get('/health')
      .expect(HttpStatus.NO_CONTENT)
      .expect('x-dns-prefetch-control', /.+?/)
      .expect('x-frame-options', /.+?/);
  });

  test('that the application returns the nel-report headers', async () => {
    await request(testModule.app.getHttpServer())
      .get('/health')
      .expect(HttpStatus.NO_CONTENT)
      .expect('nel', /.*nel-endpoint.*/);
  });

  test('that the application returns the cross-origin headers', async () => {
    await request(testModule.app.getHttpServer())
      .get('/health')
      .expect(HttpStatus.NO_CONTENT)
      .expect('access-control-allow-origin', '*')
      .expect('access-control-allow-credentials', 'true');
  });

  test('that the application returns the server-timing header', async () => {
    await request(testModule.app.getHttpServer())
      .get('/health')
      .expect(HttpStatus.NO_CONTENT)
      .expect('server-timing', /total;dur=\d+(\.\d+)?;desc="App Total"/);
  });

  test('that the application supports request validation', async () => {
    await request(testModule.app.getHttpServer())
      .post('/validate')
      .send({
        email: 'not-an-email',
      })
      .expect(HttpStatus.BAD_REQUEST)
      .expect((response) => {
        expect(response.body).toMatchObject({
          statusCode: HttpStatus.BAD_REQUEST,
          path: '/validate',
        });
      });
  });

  test('that the application disallows all crawling', async () => {
    await request(testModule.app.getHttpServer())
      .get('/robots.txt')
      .expect('Content-Type', /text\/plain/)
      .expect(HttpStatus.OK)
      .then((response) => {
        expect(response.text).toContain('User-agent: *');
        expect(response.text).toContain('Disallow: /');
      });
  });

  test('that the application renders a version badge', async () => {
    await request(testModule.app.getHttpServer())
      .get('/version.svg')
      .expect('Content-Type', 'image/svg+xml; charset=utf-8')
      .expect(HttpStatus.OK)
      .then((response) => {
        expect(response.body.toString()).toMatch(/<svg.*?svg>/);
      });
  });

  test('should have the request context set', async () => {
    await request(testModule.app.getHttpServer())
      .get('/cls-ctx')
      .expect('Content-Type', /application\/json/)
      .expect(HttpStatus.OK)
      .then((response) => {
        expect(response.body).toEqual({
          url: {
            domain: '127.0.0.1',
            full: 'http://127.0.0.1/cls-ctx',
            original: '/cls-ctx',
            path: '/',
            port: expect.any(Number),
            query: null,
            scheme: 'http',
          },
          user_agent: {
            device: {},
            original: '',
            os: { full: 'undefined undefined' },
          },
          http: { request: { method: 'GET' }, version: '1.1' },
          faas: { coldstart: expect.any(Boolean), trigger: { type: 'http' } },
        });
      });
  });
});
