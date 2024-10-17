A set of opinionated defaults for the the NestJS framework.

> [!NOTE]
> This plugin has only been is designed for use with the Express tranport. It
> also assumes that you are using Sentry and deploying this to AWS.

Here are some of the notable features of this library:

- Enables the built-in validator at the application level, thus ensuring all endpoints are protected from receiving incorrect data.
  https://docs.nestjs.com/techniques/validation
- Secures the application by using Helmet by setting the necessary HTTP response headers.
- Configures the handlebars templating engine https://docs.nestjs.com/techniques/mvc
- Configures the cookie-parsing middleware to make it easier to read and write cookies https://docs.nestjs.com/techniques/cookies
- Enables CORS support https://docs.nestjs.com/security/cors
- Enables network error logging so that client-side errors can be tracked https://web.dev/articles/network-error-logging
- Wires up Sentry so that all exceptions are reported to Sentry
  https://docs.sentry.io/platforms/javascript/guides/node/
- Configures the logger to write log messages using the Elastic Common Schema
  https://www.elastic.co/guide/en/ecs/current/index.html
- Configures a exception handler that shows pretty error pages for all 4/5xx errors
- Configures a robots.txt endpoint that disallows all crawling and indexing
- Configures the serving of static assets https://docs.nestjs.com/recipes/serve-static
- Configures a health-check endpoint like Terminus https://docs.nestjs.com/recipes/terminus
- Exports a mechanism for using Preact for SSR

## Installation

Install using NPM by using the following command

```sh
npm install --save-dev @mridang/nestjs-defaults
```

## Usage

Wiring this library comprises of two parts - configuring the NestJS application
and configuring the Express transport.

To correctly leverage this library, you must use both.

### Importing the exported module

The library exposes a module that should be imported in the root module.
Importing that module will configure all the necessary defaults. The module
requires that you specify the name of an AWS Secrets Manager configuration.

```
import { Global, Module } from '@nestjs/common';
import { DefaultsModule } from '@mridang/nestjs-defaults';

@Global()
@Module({
  imports: [
    DefaultsModule.register({
      configName: 'shush',
    }),
  ],
})
export class AppModule {
  //
}
```

### Configuring the NestJS application

The library also provides a `configure` convenience method that can be used for
setting up the transport e.g. the Handlebars templating engine, support for
parsing cookies, validation, etc.

```
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ClsService } from 'nestjs-cls';
import { AsyncLocalStorage } from 'node:async_hooks';
import compression from 'compression';
import { BetterLogger, configure } from '@mridang/nestjs-defaults';

async function bootstrap() {
  const nestApp = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger: new BetterLogger(new ClsService(new AsyncLocalStorage())),
  });

  configure(nestApp, __dirname);
  nestApp.use(compression());
  await nestApp.init();
  await nestApp.listen(3000);
}

bootstrap();
```

## Contributing

If you have suggestions for how this library could be improved, or
want to report a bug, open an issue - I'd love all and any
contributions.

## License

Apache License 2.0 © 2024 Mridang Agarwalla
