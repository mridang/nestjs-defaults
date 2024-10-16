import { Controller, Get, Header, HttpCode, HttpStatus } from '@nestjs/common';
import { makeBadge } from 'badge-maker';

@Controller()
export class VersionController {
  @HttpCode(HttpStatus.OK)
  @Get('version.svg')
  @Header('Content-Type', 'image/svg+xml')
  lookup() {
    return makeBadge({
      label: process.env.NODE_ENV?.toLowerCase() || 'unknown',
      message:
        process.env.SERVICE_VERSION?.toLowerCase().substring(0, 7) || 'unknown',
      color: (() => {
        switch (process.env.NODE_ENV?.toLowerCase()) {
          case 'prod':
          case 'production':
            return 'brightgreen';
          case undefined:
          case null:
          case '':
            return 'gray';
          default:
            return 'blue';
        }
      })(),
    });
  }
}
