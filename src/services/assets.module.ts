import { DynamicModule, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';

/**
 * Placeholder used when static-asset serving is disabled (e.g. on Cloudflare
 * Workers, where assets are served by the Workers `assets` binding rather than
 * by `@nestjs/serve-static`, which reads from the local filesystem).
 */
@Module({})
class NoopAssetsModule {}

/**
 * Serves files from `<cwd>/public` at `/static`. When `enabled` is false the
 * `@nestjs/serve-static` filesystem server is never touched.
 */
export function createAssetsModule(enabled = true): DynamicModule {
  if (!enabled) {
    return { module: NoopAssetsModule };
  }

  return ServeStaticModule.forRoot({
    rootPath: join(process.cwd(), 'public'),
    serveRoot: '/static',
  });
}
