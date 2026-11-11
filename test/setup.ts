/**
 * @file Global Jest setup that loads the local environment file before the tests run.
 */
import { config } from 'dotenv';

/**
 * Loads the local environment file before any test runs.
 * @example
 * ```ts
 * // Referenced from the Jest configuration as the global setup module.
 * ```
 */
export default async function setup(): Promise<void> {
  config();
}
