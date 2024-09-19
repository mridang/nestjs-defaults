import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AsyncLocalStorage } from 'async_hooks';

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
        tap(() => {
          const executionTime = performance.now() - startTime;

          const serverTimingHeader = Array.from(store.values())
            .map(({ key, duration, description }) => {
              const descPart = description ? `;desc="${description}"` : '';
              return `${key};dur=${duration}${descPart}`;
            })
            .concat(`total;dur=${executionTime};desc="App Total"`)
            .join(', ');

          if (!response.headersSent) {
            response.setHeader('Server-Timing', serverTimingHeader);
          }
        }),
      );
    });
  }
}

export function getAsyncLocalStorage(): Map<string, Timing> {
  return asyncLocalStorage.getStore() as Map<string, Timing>;
}
