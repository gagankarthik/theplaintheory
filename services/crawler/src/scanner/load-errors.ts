/**
 * Homepage load failures, in words a site owner can act on, plus the one case where trying plain
 * http:// is worth it: HTTPS that is refused, reset or has a broken certificate (small business
 * sites often serve only http, or have an expired certificate). DNS failures and timeouts are not
 * retried: http wouldn't fix them.
 */

const HTTPS_RETRYABLE = /ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_SSL_|ERR_CERT_|ERR_BAD_SSL|SSL_PROTOCOL/;

export function shouldRetryOverHttp(startUrl: string, error: string | undefined): boolean {
  return startUrl.startsWith("https://") && Boolean(error && HTTPS_RETRYABLE.test(error));
}

export function httpVariant(startUrl: string): string {
  return startUrl.replace(/^https:\/\//, "http://");
}

/** "We couldn't reach …" sentence for a homepage that never loaded. */
export function describeLoadError(raw: string, url: string): string {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|EAI_AGAIN/.test(raw)) return `${host} doesn't resolve to a server. Check the domain's spelling in Site settings and that its DNS is set up.`;
  if (/ERR_CONNECTION_REFUSED|ECONNREFUSED/.test(raw)) return `Nothing answered at ${host}. Check the site is online and public, then scan again.`;
  if (/ERR_CONNECTION_TIMED_OUT|ERR_TIMED_OUT|TimeoutError|Navigation timeout/i.test(raw)) return `${host} took too long to answer. If the site is slow or behind a firewall that blocks crawlers, allow our scanner and try again.`;
  if (/ERR_CERT_|ERR_SSL_|ERR_BAD_SSL/.test(raw)) return `${host} has a certificate problem, so browsers warn visitors before showing it. Fix the HTTPS certificate, then scan again.`;
  if (/ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_EMPTY_RESPONSE/.test(raw)) return `${host} dropped the connection. It may be blocking automated browsers; allow our scanner and try again.`;
  if (/ERR_TOO_MANY_REDIRECTS/.test(raw)) return `${host} redirects in a loop. Check its redirect rules, then scan again.`;
  return `We couldn't load the homepage of ${host} (${raw.slice(0, 120)}).`;
}
