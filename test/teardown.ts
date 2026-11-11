/**
 * @file Global Jest teardown, which has no external services to stop.
 */

/**
 * Runs once after the whole test run and has nothing to stop.
 * @example
 * ```ts
 * // Referenced from the Jest configuration as the global teardown module.
 * ```
 */
export default async function teardown(): Promise<void> {
  // No external services to tear down.
}
