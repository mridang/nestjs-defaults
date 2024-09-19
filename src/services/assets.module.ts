import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * The `CoreAssetsModule` configures static file serving for the application
 * using the `ServeStaticModule`. This setup allows serving static assets
 * from different directories based on their existence.
 *
 * - `existsSync(join(__dirname, '..', 'public'))`: Checks if the 'public'
 *   directory exists in the parent directory.
 *   - If the directory exists, it sets up static file serving with:
 *     - `rootPath`: The path to the 'public' directory.
 *     - `serveRoot`: The URL path (`/static`) where static files will be served.
 *   - If the directory does not exist, it sets up static file serving with:
 *     - Two configurations:
 *       1. `rootPath`: The path to a different 'public' directory in the grandparent
 *          directory.
 *          - `serveRoot`: The URL path (`/static`) for these files.
 *       2. `rootPath`: The path to the 'static' directory within the 'build' directory
 *          of the 'webapp' package.
 *          - `serveRoot`: The URL path (`/build`) for these files.
 */
export const CoreAssetsModule = ServeStaticModule.forRoot(
  ...(existsSync(join(__dirname, 'public'))
    ? [
        {
          rootPath: join(__dirname, 'public'),
          serveRoot: '/static',
        },
      ]
    : existsSync(join(__dirname, '..', 'public'))
      ? [
          {
            rootPath: join(__dirname, '..', 'public'),
            serveRoot: '/static',
          },
        ]
      : [
          {
            rootPath: join(__dirname, '..', '..', 'public'),
            serveRoot: '/static',
          },
        ]),
);
