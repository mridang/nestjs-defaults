import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { BetterLogger, configure, DefaultsModule } from './index';
import { ClsService } from 'nestjs-cls';
import { AsyncLocalStorage } from 'node:async_hooks';

async function bootstrap() {
  const nestApp = await NestFactory.create<NestExpressApplication>(
    DefaultsModule,
    {
      rawBody: true,
      logger: new BetterLogger(new ClsService(new AsyncLocalStorage())),
    },
  );

  configure(nestApp, __dirname);
  await nestApp.init();
  await nestApp.listen(3000);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap().then(() => {
  console.log('\x07');
});