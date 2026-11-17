/**
 * @file Decorator and helper that record server timing entries for a handler.
 */
import { getAsyncLocalStorage } from './timing.interceptor.js';

/**
 * Records how long a decorated method takes as a Server-Timing entry for the current request.
 *
 * The decorator name is part of the public API and is written as `@ServerTiming`, so it keeps its casing.
 * @param key - The Server-Timing metric name.
 * @param description - An optional human-readable description of the metric.
 * @returns A method decorator that wraps the method and records its duration.
 * @example
 * ```ts
 * class ReportService {
 *   @ServerTiming('db', 'Loading rows')
 *   async load() {
 *     return [];
 *   }
 * }
 * ```
 */
function serverTiming(key: string, description?: string) {
  return function serverTimingDecorator(
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (
      this: unknown,
      ...args: unknown[]
      // eslint-disable-next-line tslop/no-unknown-returns -- wraps any method, so its result passes through untouched
    ) => unknown;

    async function timed(this: unknown, ...args: unknown[]) {
      const start = performance.now();
      // eslint-disable-next-line functional/no-let -- assigned inside the try block and read after it
      let result: unknown;
      try {
        // eslint-disable-next-line unicorn/no-this-outside-of-class -- the wrapper runs as the decorated method, so `this` is the instance
        result = await originalMethod.apply(this, args);
      } catch (error) {
        const end = performance.now();
        const executionTime = end - start;
        const store = getAsyncLocalStorage();
        if (store) {
          // eslint-disable-next-line functional/immutable-data -- recording the timing in the request's own store is the point of the decorator
          store.set(propertyKey, {
            key,
            duration: executionTime,
            description,
          });
        }
        throw error;
      }
      const end = performance.now();
      const executionTime = end - start;
      const store = getAsyncLocalStorage();
      // eslint-disable-next-line functional/immutable-data -- recording the timing in the request's own store is the point of the decorator
      store.set(propertyKey, { key, duration: executionTime, description });
      return result;
    }
    // eslint-disable-next-line functional/immutable-data -- a method decorator works by replacing the value on its descriptor
    descriptor.value = timed;

    return descriptor;
  };
}

export { serverTiming as ServerTiming };
