import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('health')
export class DefaultController {
  @Get()
  @HttpCode(HttpStatus.NO_CONTENT)
  check() {
    //
  }
}
