/**
 * @file Nest module that optionally serves the public directory as static files.
 */
import { DynamicModule, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import path from 'node:path';

/**
 * Placeholder used when static-asset serving is disabled (e.g. On Cloudflare
 * Workers, where assets are served by the Workers `assets` binding rather than
 * by `@nestjs/serve-static`, which reads from the local filesystem).
 */
@Module({})
class NoopAssetsModule {}

/**
 * Serves files from `<cwd>/public` at `/static`. When `enabled` is false the
 * `@nestjs/serve-static` filesystem server is never touched.
 * @param enabled - Whether static files are served from the local filesystem.
 * @returns A dynamic module that serves the public directory, or a no-op module when disabled.
 * @example
 * ```ts
 * const disabled = createAssetsModule(false);
 * ```
 */
export function createAssetsModule(enabled = true): DynamicModule {
  if (!enabled) {
    return { module: NoopAssetsModule };
  }

  return ServeStaticModule.forRoot({
    rootPath: path.join(process.cwd(), 'public'),
    serveRoot: '/static',
  });
}
