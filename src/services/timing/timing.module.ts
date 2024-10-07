import { Module, Global } from '@nestjs/common';
import { TimingInterceptor } from './timing.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

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
