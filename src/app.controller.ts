import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class DefaultController {
  @Get()
  check() {
    return 'Ok';
  }
}
