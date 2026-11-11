/**
 * @file Turns the CSP and Reporting API reports browsers send into short, safe log summaries.
 *
 * Reading the reports browsers send about this site. Two formats arrive at the
 * same address: the Reporting API's (`application/reports+json`, a list of
 * `{ type, url, body }`) and the older CSP one (`application/csp-report`, one
 * `{ "csp-report": {…} }`). Both are boiled down to the same few facts, kept
 * short, with query strings and fragments cut off (an address on this site can
 * carry a sign-in code or a search) and anything from a browser extension left
 * out, because extensions inject scripts and styles into pages and every one of
 * them would otherwise be reported as a fault in the site.
 *
 * Reports come from anyone's browser, or from anyone pretending to be one, so
 * nothing in them is trusted: every field is cut to a short length and made
 * printable before it is logged.
 */

/** One report, reduced to what is worth a log line. */
export interface ReportSummary {
  /** The report kind, such as `csp-violation` or `deprecation`. */
  readonly type: string;
  /** The page it happened on: path only. */
  readonly page: string;
  /** What was blocked: `inline`, `eval`, `trusted-types-sink`, or an origin. */
  readonly blocked: string;
  /** The directive that was violated (`script-src-elem`, `require-trusted-types-for`, and so on). */
  readonly directive: string;
  /** `enforce` or `report`. */
  readonly disposition: string;
  /** The start of the offending code, if the browser gave it. */
  readonly sample: string;
  /** Where in which file, path only, if the browser said. */
  readonly source: string;
}

/** A report kind paired with the body of that report. */
type ReportEntry = readonly [string, Readonly<Record<string, unknown>>];

/** The most reports taken from one request. */
const MAX_REPORTS_PER_REQUEST = 20;

/** The schemes extensions use for their own addresses. */
const EXTENSION_SCHEME =
  /^(?:chrome|moz|safari|safari-web|ms-browser|edge)-extension:/i;

/**
 * Tells whether a value is a plain JSON object rather than an array or null.
 * @param value - The value to check.
 * @returns True when `value` is a non-array object.
 * @example
 * ```ts
 * isRecord({ a: 1 }); // true
 * isRecord([]); // false
 * ```
 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Cuts a value down to printable text of at most `limit` characters.
 * @param value - The value to cut, which is ignored unless it is a string.
 * @param limit - The longest length, in characters, the result may have.
 * @returns The cleaned text, or an empty string when `value` is not text.
 * @example
 * ```ts
 * short('line one\nline two', 8); // 'line one'
 * short(42, 8); // ''
 * ```
 */
function short(value: unknown, limit: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  // Control characters (a line break in a log line could pass for another line) become spaces.
  const printable = Array.from(value.slice(0, limit * 2), (char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 32 || code === 127 ? ' ' : char;
  }).join('');
  return printable.replaceAll(/\s+/g, ' ').trim().slice(0, limit);
}

/**
 * Finds the first of several field names whose value in a report is text.
 * @param body - The report body to search.
 * @param keys - The field names to try, in order of preference.
 * @returns The first text value found, or an empty string when none is text.
 * @example
 * ```ts
 * field({ 'document-uri': 'https://x.test/a' }, 'documentURL', 'document-uri');
 * // 'https://x.test/a'
 * ```
 */
function field(
  body: Readonly<Record<string, unknown>>,
  ...keys: readonly string[]
): string {
  return (
    (keys.map((key) => body[key]).find((v) => typeof v === 'string') as
      string | undefined) ?? ''
  );
}

/**
 * Reduces an address to its path, dropping the origin, query and fragment.
 * @param address - The full address as the browser reported it.
 * @returns The path, at most 200 characters long, or an empty string when the address is not a valid URL.
 * @example
 * ```ts
 * pathOf('https://example.test/a/b?token=1#x'); // '/a/b'
 * ```
 */
function pathOf(address: string): string {
  try {
    return new URL(address).pathname.slice(0, 200);
  } catch {
    return '';
  }
}

/**
 * Describes what was blocked without the address itself, using the keywords browsers use or the origin.
 * @param address - The blocked address or keyword reported by the browser.
 * @returns The keyword unchanged, the origin of the address, or a short cut of the text.
 * @example
 * ```ts
 * blockedOf('inline'); // 'inline'
 * blockedOf('https://cdn.example.test/x.js'); // 'https://cdn.example.test'
 * ```
 */
function blockedOf(address: string): string {
  if (
    address === '' ||
    /^(?:inline|eval|self|trusted-types-sink|wasm-eval)$/.test(address)
  ) {
    return address;
  }
  try {
    const { origin, protocol } = new URL(address);
    return origin === 'null' ? protocol : origin;
  } catch {
    return short(address, 40);
  }
}

/**
 * Tells whether a report was caused by a browser extension and so says nothing about the site.
 * @param body - The report body to inspect.
 * @returns True when the blocked or source address uses an extension scheme.
 * @example
 * ```ts
 * fromExtension({ 'blocked-uri': 'chrome-extension://abc/x.js' }); // true
 * ```
 */
function fromExtension(body: Readonly<Record<string, unknown>>): boolean {
  return [
    field(body, 'blockedURL', 'blocked-uri'),
    field(body, 'sourceFile', 'source-file'),
  ].some((address) => EXTENSION_SCHEME.test(address));
}

/**
 * Boils one report body down to a summary of its key facts.
 * @param type - The report kind, as the browser named it.
 * @param body - The report body holding the details.
 * @returns A summary with every field cut to a short, printable length.
 * @example
 * ```ts
 * summarise('csp-violation', { 'violated-directive': 'script-src' });
 * ```
 */
function summarise(
  type: string,
  body: Readonly<Record<string, unknown>>,
): ReportSummary {
  return {
    type: short(type, 40) || 'unknown',
    page: pathOf(field(body, 'documentURL', 'document-uri')),
    blocked: blockedOf(field(body, 'blockedURL', 'blocked-uri')),
    directive: short(
      field(
        body,
        'effectiveDirective',
        'effective-directive',
        'violated-directive',
      ),
      60,
    ),
    disposition: short(field(body, 'disposition'), 10),
    sample: short(field(body, 'sample', 'script-sample'), 80),
    source: [
      pathOf(field(body, 'sourceFile', 'source-file')),
      field(body, 'lineNumber', 'line-number') ||
        (typeof body['lineNumber'] === 'number'
          ? String(body['lineNumber'])
          : ''),
    ]
      .filter(Boolean)
      .join(':'),
  };
}

/**
 * Collects the report entries from a request body in either supported format.
 * @param body - The parsed request body, either a Reporting API list or a CSP report object.
 * @returns The report kind and body pairs found, or an empty list when the body holds no report.
 * @example
 * ```ts
 * reportEntries({ 'csp-report': { 'document-uri': 'https://x.test/' } });
 * ```
 */
function reportEntries(body: unknown): readonly ReportEntry[] {
  if (Array.isArray(body)) {
    return body.flatMap((entry): ReportEntry[] =>
      isRecord(entry) && isRecord(entry['body'])
        ? [[short(entry['type'], 40), entry['body']]]
        : [],
    );
  }
  if (isRecord(body) && isRecord(body['csp-report'])) {
    return [['csp-violation', body['csp-report']]];
  }
  return [];
}

/**
 * Lists the reports in a request body as summaries, whichever format it came in.
 *
 * Extension-caused reports are left out, at most {@link MAX_REPORTS_PER_REQUEST} are kept, and anything that is not a report is ignored.
 * @param body - The parsed request body, in either the Reporting API or the CSP format.
 * @returns The summaries of the reports that concern the site itself.
 * @example
 * ```ts
 * summariseReports([
 *   { type: 'deprecation', body: { id: 'x', disposition: 'report' } },
 * ]);
 * ```
 */
export function summariseReports(body: unknown): readonly ReportSummary[] {
  return reportEntries(body)
    .slice(0, MAX_REPORTS_PER_REQUEST)
    .filter(([, report]) => !fromExtension(report))
    .map(([type, report]) => summarise(type, report));
}
