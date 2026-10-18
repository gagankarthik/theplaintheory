import { describe, expect, it } from "vitest";
import { describeLoadError, httpVariant, shouldRetryOverHttp } from "../src/scanner/load-errors";

describe("homepage load errors", () => {
  it("retries refused, reset and certificate failures over http, but not DNS or timeouts", () => {
    const u = "https://shop.example/";
    expect(shouldRetryOverHttp(u, "net::ERR_CONNECTION_REFUSED at https://shop.example/")).toBe(true);
    expect(shouldRetryOverHttp(u, "net::ERR_CERT_DATE_INVALID")).toBe(true);
    expect(shouldRetryOverHttp(u, "net::ERR_NAME_NOT_RESOLVED")).toBe(false);
    expect(shouldRetryOverHttp(u, "net::ERR_CONNECTION_TIMED_OUT")).toBe(false);
    expect(shouldRetryOverHttp("http://shop.example/", "net::ERR_CONNECTION_REFUSED")).toBe(false);
    expect(httpVariant(u)).toBe("http://shop.example/");
  });

  it("explains failures in plain words with a next step", () => {
    expect(describeLoadError("net::ERR_NAME_NOT_RESOLVED", "https://shop.example/")).toMatch(/doesn't resolve.*Site settings/);
    expect(describeLoadError("net::ERR_CONNECTION_REFUSED", "https://shop.example/")).toBe("Nothing answered at shop.example. Check the site is online and public, then scan again.");
    expect(describeLoadError("net::ERR_CERT_AUTHORITY_INVALID", "https://shop.example/")).toMatch(/certificate problem/);
    expect(describeLoadError("weird", "https://shop.example/")).toMatch(/^We couldn't load the homepage of shop.example \(weird\)/);
  });
});
