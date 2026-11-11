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
// eslint-disable-next-line sonarjs/function-name -- the decorator is public API and is used as @ServerTiming
export function ServerTiming(key: string, description?: string) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const start = performance.now();
      let result;
      try {
        // eslint-disable-next-line unicorn/no-this-outside-of-class -- the wrapped method must receive the instance as this
        result = await originalMethod.apply(this, args);
      } catch (error) {
        const end = performance.now();
        const executionTime = end - start;
        const store = getAsyncLocalStorage();
        if (store) {
          store.set(propertyKey, { key, duration: executionTime, description });
        }
        throw error;
      }
      const end = performance.now();
      const executionTime = end - start;
      const store = getAsyncLocalStorage();
      store.set(propertyKey, { key, duration: executionTime, description });
      return result;
    };

    return descriptor;
  };
}
