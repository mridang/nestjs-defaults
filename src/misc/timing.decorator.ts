import { getAsyncLocalStorage } from '../timing.interceptor';

export function ServerTiming(key: string, description?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const start = performance.now();
      let result;
      try {
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
