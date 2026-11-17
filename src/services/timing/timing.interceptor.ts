/**
 * @file Interceptor that measures handler duration and adds it to the Server-Timing header.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
// eslint-disable-next-line e18e/ban-dependencies -- express is the Nest HTTP adapter this library targets and the import is type-only; h3 does not provide these types, so the swap is not a drop-in
import type { Response } from 'express';

const asyncLocalStorage = new AsyncLocalStorage<Map<string, Timing>>();

type Timing = {
  key: string;
  duration: number;
  description?: string;
};

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    const startTime = performance.now();
    const response = context.switchToHttp().getResponse<Response>();

    const store = new Map<string, Timing>();

    return asyncLocalStorage.run(store, () =>
      next.handle().pipe(
        finalize(() => {
          const executionTime = performance.now() - startTime;

          const serverTimingHeader = [
            ...Array.from(store.values(), ({ key, duration, description }) => {
              const descPart = description ? `;desc="${description}"` : '';
              return `${key};dur=${duration}${descPart}`;
            }),
            `total;dur=${executionTime};desc="App Total"`,
          ].join(', ');

          if (!response.headersSent) {
            response.setHeader('Server-Timing', serverTimingHeader);
          }
        }),
      ),
    );
  }
}

/**
 * Returns the timing map that belongs to the request currently being handled.
 * @returns The Server-Timing entries for the current request, or undefined outside a request.
 * @example
 * ```ts
 * getAsyncLocalStorage()?.set('db', { key: 'db', duration: 12 });
 * ```
 */
export function getAsyncLocalStorage(): Map<string, Timing> | undefined {
  return asyncLocalStorage.getStore();
}
