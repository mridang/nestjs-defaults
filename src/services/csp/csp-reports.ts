/**
 * @packageDocumentation
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
  /** `csp-violation`, `deprecation`, `permissions-policy-violation`, … */
  readonly type: string;
  /** The page it happened on: path only. */
  readonly page: string;
  /** What was blocked: `inline`, `eval`, `trusted-types-sink`, or an origin. */
  readonly blocked: string;
  /** The directive that was violated (`script-src-elem`, `require-trusted-types-for`, …). */
  readonly directive: string;
  /** `enforce` or `report`. */
  readonly disposition: string;
  /** The start of the offending code, if the browser gave it. */
  readonly sample: string;
  /** Where in which file, path only, if the browser said. */
  readonly source: string;
}

/** The most reports taken from one request. */
const MAX_REPORTS_PER_REQUEST = 20;

/** The schemes extensions use for their own addresses. */
const EXTENSION_SCHEME =
  /^(?:chrome|moz|safari|safari-web|ms-browser|edge)-extension:/i;

/** A JSON object. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `value` as text cut to `limit` characters, printable only, or '' if it is not text. */
function short(value: unknown, limit: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  // Control characters (a line break in a log line could pass for another line) become spaces.
  const printable = [...value.slice(0, limit * 2)]
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < 32 || code === 127 ? ' ' : char;
    })
    .join('');
  return printable.replace(/\s+/g, ' ').trim().slice(0, limit);
}

/** The first of `keys` in `body` that holds text. */
function field(
  body: Readonly<Record<string, unknown>>,
  ...keys: readonly string[]
): string {
  return (
    (keys.map((key) => body[key]).find((v) => typeof v === 'string') as
      | string
      | undefined) ?? ''
  );
}

/** The path of an address, without its origin, query or fragment; '' when it is not one. */
function pathOf(address: string): string {
  try {
    return new URL(address).pathname.slice(0, 200);
  } catch {
    return '';
  }
}

/**
 * What a blocked address says about the block without the address itself: the
 * keywords browsers use (`inline`, `eval`, `self`), or just the origin.
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

/** Whether a report was caused by a browser extension (and so says nothing about the site). */
function fromExtension(body: Readonly<Record<string, unknown>>): boolean {
  return [
    field(body, 'blockedURL', 'blocked-uri'),
    field(body, 'sourceFile', 'source-file'),
  ].some((address) => EXTENSION_SCHEME.test(address));
}

/** Boil one report body down to a summary. */
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
 * The reports in a request body, whichever format it came in, as summaries,
 * leaving out anything an extension caused and keeping at most
 * {@link MAX_REPORTS_PER_REQUEST}. Anything that is not a report is ignored.
 */
export function summariseReports(body: unknown): readonly ReportSummary[] {
  const entries: readonly (readonly [
    string,
    Readonly<Record<string, unknown>>,
  ])[] = Array.isArray(body)
    ? body.flatMap((entry): [string, Readonly<Record<string, unknown>>][] =>
        isRecord(entry) && isRecord(entry['body'])
          ? [[short(entry['type'], 40), entry['body']]]
          : [],
      )
    : isRecord(body) && isRecord(body['csp-report'])
      ? [['csp-violation', body['csp-report']]]
      : [];
  return entries
    .slice(0, MAX_REPORTS_PER_REQUEST)
    .filter(([, report]) => !fromExtension(report))
    .map(([type, report]) => summarise(type, report));
}
