/**
 * @file Nest module that provides the core runtime implementations of fetch and crypto.
 */
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
      useValue: Reflect.get(globalThis, 'crypto'),
    },
  ],
  exports: [FetchImpl, CryptoImpl],
})
export class NodeModule {
  //
}
