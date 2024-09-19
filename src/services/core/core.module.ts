import { Module, Global } from '@nestjs/common';
import { CryptoImpl, FetchImpl } from './types';

@Global()
@Module({
  providers: [
    {
      provide: FetchImpl,
      useValue: fetch,
    },
    {
      provide: CryptoImpl,
      useValue: crypto,
    },
  ],
  exports: [FetchImpl, CryptoImpl],
})
export class NodeModule {
  //
}
