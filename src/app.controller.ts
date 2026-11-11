/**
 * @file Health-check controller that answers the bare health route with no content.
 */
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('health')
export class DefaultController {
  @Get()
  @HttpCode(HttpStatus.NO_CONTENT)
  check() {
    //
  }
}
