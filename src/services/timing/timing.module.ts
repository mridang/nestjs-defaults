/**
 * @file Nest module that registers the server timing interceptor.
 */
import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TimingInterceptor } from './timing.interceptor.js';

@Global()
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TimingInterceptor,
    },
  ],
})
export class TimingModule {
  //
}
