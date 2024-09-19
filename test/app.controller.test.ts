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

  @Get('cors-test')
  getCorsTest() {
    return { message: 'CORS is enabled' };
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

  test('/health (GET)', () => {
    return request(testModule.app.getHttpServer())
      .get('/health')
      .expect(HttpStatus.OK)
      .expect('Ok');
  });

  test('/404 (GET)', async () => {
    await request(testModule.app.getHttpServer())
      .get('/404')
      .set('Accept', 'text/html')
      .expect(HttpStatus.NOT_FOUND)
      .expect('Content-Type', 'text/html; charset=UTF-8')
      .expect((response) => {
        if (!response.text.includes('<title>Not Found</title>')) {
          throw new Error('Expected text not found in response');
        }
      });
  });

  test('/500 (GET)', async () => {
    await request(testModule.app.getHttpServer())
      .get('/500')
      .set('Accept', 'text/html')
      .expect(HttpStatus.INTERNAL_SERVER_ERROR)
      .expect('Content-Type', 'text/html; charset=UTF-8')
      .expect((response) => {
        if (!response.text.includes('<title>Internal server error</title>')) {
          throw new Error('Expected text not found in response');
        }
      });
  });

  test('/error (GET)', async () => {
    await request(testModule.app.getHttpServer())
      .get('/error')
      .set('Accept', 'text/html')
      .expect(HttpStatus.INTERNAL_SERVER_ERROR)
      .expect('Content-Type', 'text/html; charset=UTF-8')
      .expect((response) => {
        if (!response.text.includes('<title>Internal server error</title>')) {
          throw new Error('Expected text not found in response');
        }
      });
  });

  test('should set and read a cookie', async () => {
    await request(testModule.app.getHttpServer())
      .get('/set-cookie')
      .expect((res) => {
        expect(res.headers['set-cookie']).toContainEqual(
          expect.stringContaining(`test=NestJS`),
        );
      });

    await request(testModule.app.getHttpServer())
      .get('/read-cookie')
      .set('Cookie', [`test=NestJS`])
      .expect(HttpStatus.OK)
      .expect('NestJS');
  });

  test('should include security headers', async () => {
    await request(testModule.app.getHttpServer())
      .get('/some-path')
      .expect((res) => {
        expect(res.headers['x-dns-prefetch-control']).toBeDefined();
        expect(res.headers['x-frame-options']).toBeDefined();
      });
  });

  test('should have the Server-Timing header', async () => {
    await request(testModule.app.getHttpServer())
      .get('/health')
      .expect(HttpStatus.OK)
      .expect((res) => {
        expect(res.headers['server-timing']).toMatch(
          /total;dur=\d+(\.\d+)?;desc="App Total"/,
        );
      });
  });

  test('should handle request validation', async () => {
    const response = await request(testModule.app.getHttpServer())
      .post('/validate')
      .send({
        email: 'not-an-email',
      })
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      path: '/validate',
    });
  });

  test('should disallow all crawling', async () => {
    await request(testModule.app.getHttpServer())
      .get('/robots.txt')
      .expect('Content-Type', /text\/plain/)
      .expect(200)
      .then((response) => {
        expect(response.text).toContain('User-agent: *');
        expect(response.text).toContain('Disallow: /');
      });
  });

  test('should have the request context set', async () => {
    await request(testModule.app.getHttpServer())
      .get('/cls-ctx')
      .expect('Content-Type', /application\/json/)
      .expect(200)
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
