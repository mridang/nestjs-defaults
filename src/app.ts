import { NestExpressApplication } from '@nestjs/platform-express';
import { CustomHttpExceptionFilter } from './errorpage.exception.filter';
import { join } from 'path';
import { handlebars } from 'hbs';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { default as helm } from 'helmet';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { BetterLogger } from './logger';

handlebars.registerHelper('json', function (context) {
  return JSON.stringify(context);
});

export default function configure(
  nestApp: NestExpressApplication,
  baseDir?: string,
) {
  nestApp.useLogger(nestApp.get(BetterLogger));
  nestApp.useGlobalFilters(new CustomHttpExceptionFilter(baseDir));
  nestApp.setViewEngine('hbs');
  nestApp.setBaseViewsDir(
    fs.existsSync(join(__dirname, 'views'))
      ? join(__dirname, 'views')
      : join(__dirname, '..', 'views'),
  );
  nestApp.engine(
    'hbs',
    (
      filePath: string,
      options: Record<string, object>,
      callback: (err: Error | null, rendered?: string) => void,
    ) => {
      const template = handlebars.compile(fs.readFileSync(filePath, 'utf8'));
      const result = template(options);
      callback(null, result);
    },
  );

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
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'avatars.githubusercontent.com'],
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