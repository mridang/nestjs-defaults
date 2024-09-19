import { ClsModule } from 'nestjs-cls';

/**
 * The `CoreContinuationModule` is a global module configuration for the `ClsModule`,
 * which is used to manage and store server timings of different spans within a
 * request context. By utilizing the `ClsModule`, this module provides a way to
 * maintain the context of ongoing operations and trace their timings across different
 * parts of a request. This is especially useful in distributed systems and for
 * monitoring performance metrics, as it allows for precise tracking of server
 * activities and spans within the same request lifecycle.
 *
 * Configuration:
 * - `global: true` ensures that this module is available throughout the entire
 *   application, making it easier to track and manage request contexts globally.
 */
export const CoreContinuationModule = ClsModule.forRoot({
  global: true,
});
