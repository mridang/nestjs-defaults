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
      // eslint-disable-next-line n/no-unsupported-features/node-builtins -- the Web Crypto global exists on every supported Node version (22 and newer)
      useValue: globalThis.crypto,
    },
  ],
  exports: [FetchImpl, CryptoImpl],
})
export class NodeModule {
  //
}
