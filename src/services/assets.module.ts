import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

export const CoreAssetsModule = ServeStaticModule.forRoot({
  rootPath: join(process.cwd(), 'public'),
  serveRoot: '/static',
});
