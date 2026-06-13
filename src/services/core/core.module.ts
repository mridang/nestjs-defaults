import { Module, Global } from '@nestjs/common';
import { CryptoImpl, FetchImpl } from './types.js';

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
