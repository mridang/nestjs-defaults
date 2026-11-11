/**
 * @file Interceptor that measures handler duration and adds it to the Server-Timing header.
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AsyncLocalStorage } from 'node:async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();

type Timing = {
  key: string;
  duration: number;
  description?: string;
};

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    const startTime = performance.now();
    const response = context.switchToHttp().getResponse();

    return asyncLocalStorage.run(new Map<string, Timing>(), () => {
      const store = asyncLocalStorage.getStore() as Map<string, Timing>;

      return next.handle().pipe(
        finalize(() => {
          const executionTime = performance.now() - startTime;

          const serverTimingHeader = [
            ...[...store.values()].map(({ key, duration, description }) => {
              const descPart = description ? `;desc="${description}"` : '';
              return `${key};dur=${duration}${descPart}`;
            }),
            `total;dur=${executionTime};desc="App Total"`,
          ].join(', ');

          if (!response.headersSent) {
            response.setHeader('Server-Timing', serverTimingHeader);
          }
        }),
      );
    });
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
export function getAsyncLocalStorage(): Map<string, Timing> {
  return asyncLocalStorage.getStore() as Map<string, Timing>;
}
