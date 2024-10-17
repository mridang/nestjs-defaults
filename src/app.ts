import { NestExpressApplication } from '@nestjs/platform-express';
import { CustomHttpExceptionFilter } from './services/errors/errors.filter';
import cookieParser from 'cookie-parser';
// eslint-disable-next-line import/namespace
import { default as helm } from 'helmet';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { BetterLogger } from './logger';

export default function configure(nestApp: NestExpressApplication) {
  nestApp.useLogger(nestApp.get(BetterLogger));
  nestApp.useGlobalFilters(new CustomHttpExceptionFilter());
  nestApp.use('/robots.txt', (_req: Request, res: Response) => {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /');
  });
  nestApp.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'X-Lambda-Start',
      process.env.LAMBDA_COLD_START === 'warm' ? 'Warm' : 'Cold',
    );
    process.env.LAMBDA_COLD_START = 'warm';
    next();
  });
  nestApp.use(cookieParser());
  nestApp.use(
    helm({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': [
            "'self'",
            "'unsafe-inline'",
            'js.pusher.com',
            "'unsafe-eval'",
          ],
          'connect-src': [
            "'self'",
            '*.pusher.com',
            'ws.pusherapp.com',
            'wss://ws-mt1.pusher.com',
            '*.sentry.io',
          ],
          'worker-src': ["'self'", 'blob:'],
          'style-src': ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
          'img-src': ["'self'", 'data:', 'avatars.githubusercontent.com'],
          'font-src': ["'self'", 'fonts.gstatic.com'],
          'form-action': ['*'],
        },
      },
    }),
  );
  nestApp.enableCors({
    credentials: true,
  });
  nestApp.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => ({
          property: error.property,
          constraints: error.constraints,
        }));
        return new BadRequestException(messages);
      },
    }),
  );

  return nestApp;
}
