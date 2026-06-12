A set of opinionated defaults for the NestJS framework.

> [!NOTE]
> This library targets the Express transport on Node and Cloudflare Workers
> (via [`@mridang/nestjs-platform-cloudflare`](https://github.com/mridang/nestjs-platform-cloudflare)).
> Sentry and AWS Secrets Manager are optional: Sentry self-disables when no
> `SENTRY_DSN` is configured, and secrets are read from the environment unless
> you opt into another source.

Here are some of the notable features of this library:

- Enables the built-in validator at the application level, thus ensuring all endpoints are protected from receiving incorrect data.
  https://docs.nestjs.com/techniques/validation
- Secures the application by using Helmet by setting the necessary HTTP response headers.
- Configures the handlebars templating engine https://docs.nestjs.com/techniques/mvc
- Configures the cookie-parsing middleware to make it easier to read and write cookies https://docs.nestjs.com/techniques/cookies
- Enables CORS support https://docs.nestjs.com/security/cors
- Enables network error logging so that client-side errors can be tracked https://web.dev/articles/network-error-logging
- Reports exceptions to Sentry when a `SENTRY_DSN` is configured, using the SDK for the active runtime
  https://docs.sentry.io/
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

Wiring this library comprises two parts — configuring the NestJS application and
configuring the transport. To correctly leverage this library, you must use
both.

### Importing the exported module

The library exposes a module that should be imported in the root module.
Importing it configures all the necessary defaults. With no options it reads
configuration from the environment, which is correct for Cloudflare Workers and
local development.

```
import { Global, Module } from '@nestjs/common';
import { DefaultsModule } from '@mridang/nestjs-defaults';

@Global()
@Module({
  imports: [DefaultsModule.register({})],
})
export class AppModule {}
```

`register` accepts a few options:

- `secrets` — where configuration secrets come from. Defaults to the process
  environment. To load a JSON bundle from AWS Secrets Manager, pass an
  `AwsSecretsManagerSource` (the `@aws-sdk/client-secrets-manager` peer is then
  required and loaded lazily):

  ```
  import {
    DefaultsModule,
    AwsSecretsManagerSource,
  } from '@mridang/nestjs-defaults';

  DefaultsModule.register({
    secrets: new AwsSecretsManagerSource('my-secret-id'),
  });
  ```

- `assets` — serve `public/` at `/static`. Defaults to `true`; set `false` on
  runtimes without a local filesystem (e.g. Cloudflare Workers, where the
  Workers `assets` binding serves static files instead).
- `sentry` — enable Sentry insights. Defaults to `true`; Sentry self-disables
  when no `SENTRY_DSN` is configured.

### Configuring the application

The library also provides a `configure` convenience function that sets up the
transport — the Handlebars templating engine, cookie parsing, validation, the
request-context middleware, the exception filter, and so on.

On Node with the Express transport:

```
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ClsService } from 'nestjs-cls';
import { AsyncLocalStorage } from 'node:async_hooks';
import { BetterLogger, configure } from '@mridang/nestjs-defaults';
import { AppModule } from './app.module';

async function bootstrap() {
  const nestApp = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger: new BetterLogger(new ClsService(new AsyncLocalStorage())),
  });

  configure(nestApp);
  await nestApp.init();
  await nestApp.listen(3000);
}

bootstrap();
```

On Cloudflare Workers, boot through the fetch-native adapter and call
`configure` after `init` (see
[`@mridang/nestjs-platform-cloudflare`](https://github.com/mridang/nestjs-platform-cloudflare)
for the full worker entry):

```
import { NestFactory } from '@nestjs/core';
import { configure } from '@mridang/nestjs-defaults';
import { CloudflareAdapter } from '@mridang/nestjs-platform-cloudflare';
import { AppModule } from './app.module';

const adapter = new CloudflareAdapter();
const app = await NestFactory.create(AppModule, adapter, {
  rawBody: true,
  logger: false,
});
await app.init();
configure(app);

export default { fetch: (request) => adapter.handle(request) };
```

`BetterLogger` selects its output strategy per runtime — structured objects to
`console` on Workers, JSON lines to stdout in Node production, and a readable
line otherwise — so no runtime-specific wiring is needed.

## Contributing

If you have suggestions for how this library could be improved, or
want to report a bug, open an issue - I'd love all and any
contributions.

## License

Apache License 2.0 © 2024 Mridang Agarwalla
