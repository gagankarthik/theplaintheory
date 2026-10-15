// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://shop.example/"}
import { afterEach, describe, expect, it } from "vitest";
import { ALL, NONE, isFresh, randomId, readGcmFlag, readStored, writeGcmFlag, writeStored } from "../../sdk/src/storage";
import type { Stored } from "../../sdk/src/types";
import { publicConfig } from "./fixture";

const DAY = 86400000;
const rec = (o: Partial<Stored> = {}): Stored => ({ v: 1, f: "gdpr", c: { ...ALL }, t: Date.now(), id: randomId(), ...o });

afterEach(() => {
  writeStored(null);
  localStorage.clear();
});

describe("consent record storage", () => {
  it("writes a first-party cookie mirrored to localStorage, and reads it back", () => {
    const s = rec({ l: "hi" });
    writeStored(s, 30);
    expect(document.cookie).toContain("plain_consent=");
    expect(JSON.parse(localStorage.getItem("plain_consent")!)).toEqual(s);
    expect(readStored()).toEqual(s);
  });

  it("falls back to localStorage when the cookie is gone", () => {
    const s = rec();
    writeStored(s);
    document.cookie = "plain_consent=;Max-Age=0;Path=/";
    expect(readStored()).toEqual(s);
  });

  it("clears both on revoke, and survives corrupt data", () => {
    writeStored(rec());
    writeStored(null);
    expect(readStored()).toBeNull();
    localStorage.setItem("plain_consent", "{not json");
    expect(readStored()).toBeNull();
  });

  it("visitor ids are random 128-bit hex", () => {
    const a = randomId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(randomId()).not.toBe(a);
  });

  it("remembers the Consent Mode flag", () => {
    expect(readGcmFlag()).toBeNull();
    writeGcmFlag(true);
    expect(readGcmFlag()).toBe(true);
    writeGcmFlag(false);
    expect(readGcmFlag()).toBe(false);
  });
});

describe("isFresh", () => {
  const cfg = { ...publicConfig(), version: 3, expiryDays: 30, reask: 90 };
  const now = Date.now();

  it("a choice is valid for the same config version within the expiry", () => {
    expect(isFresh(rec({ v: 3, t: now - 29 * DAY }), cfg, now)).toBe(true);
    expect(isFresh(rec({ v: 3, t: now - 31 * DAY }), cfg, now)).toBe(false);
  });

  it("a new config version asks again", () => {
    expect(isFresh(rec({ v: 2, t: now }), cfg, now)).toBe(false);
    expect(isFresh(null, cfg, now)).toBe(false);
  });

  it("a reject-all is kept for the re-ask window instead of the expiry", () => {
    const rejected = rec({ v: 3, c: { ...NONE }, t: now - 60 * DAY, r: now - 60 * DAY });
    expect(isFresh(rejected, cfg, now)).toBe(true);
    expect(isFresh({ ...rejected, r: now - 91 * DAY }, cfg, now)).toBe(false);
  });
});
