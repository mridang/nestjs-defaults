/**
 * @file Global Jest setup that loads the local environment file before the tests run.
 */
// eslint-disable-next-line e18e/ban-dependencies -- process.loadEnvFile throws when .env is missing where config() ignores it, so the swap would change test setup
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
