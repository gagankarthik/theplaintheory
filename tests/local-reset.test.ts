import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Store } from "@/lib/store/types";

/** The e-mails the reset sends, captured instead of going to SES. */
const sent: { to: string; paragraphs: string[] }[] = [];
vi.mock("@/lib/mail", () => ({
  sendMail: async (m: { to: string; paragraphs: string[] }) => {
    sent.push(m);
    return { sent: true };
  },
}));

const dir = mkdtempSync(path.join(tmpdir(), "pt-reset-"));
let store: Store;
let reset: typeof import("@/lib/auth/local-reset");
const EMAIL = "reset@example.test";

const lastCode = () => sent.at(-1)!.paragraphs[0].match(/(\d{6})$/)![1];

beforeAll(async () => {
  process.env.LOCAL_DATA_DIR = dir;
  process.env.SESSION_SECRET = "test-secret-for-reset-codes-0123456789";
  delete process.env.STORE_DRIVER;
  store = (await import("@/lib/store/local")).localStore;
  reset = await import("@/lib/auth/local-reset");
  await store.createUser({ id: "usr_reset", email: EMAIL, name: "Reset Tester", passwordHash: "x", createdAt: new Date().toISOString() } as never);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
  sent.length = 0;
  vi.useRealTimers();
});

describe("local password reset", () => {
  it("e-mails a 6-digit code and stores only its digest", async () => {
    await reset.issueLocalReset(EMAIL);
    expect(sent).toHaveLength(1);
    const code = lastCode();
    const user = await store.getUserByEmail(EMAIL);
    expect(user?.passwordReset?.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(user)).not.toContain(code);
  });

  it("sends nothing for an address without an account", async () => {
    await reset.issueLocalReset("nobody@example.test");
    expect(sent).toHaveLength(0);
  });

  it("accepts the right code and refuses a wrong one", async () => {
    await reset.issueLocalReset(EMAIL);
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await reset.checkLocalReset(EMAIL, wrong)).toMatchObject({ ok: false, kind: "code_mismatch" });
    expect(await reset.checkLocalReset(EMAIL, code)).toMatchObject({ ok: true });
  });

  it("voids the code after five wrong tries", async () => {
    await reset.issueLocalReset(EMAIL);
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < reset.RESET_MAX_ATTEMPTS; i++) await reset.checkLocalReset(EMAIL, wrong);
    expect(await reset.checkLocalReset(EMAIL, code)).toMatchObject({ ok: false, kind: "code_expired" });
    expect((await store.getUserByEmail(EMAIL))?.passwordReset).toBeUndefined();
  });

  it("expires the code after 15 minutes", async () => {
    await reset.issueLocalReset(EMAIL);
    const code = lastCode();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + reset.RESET_CODE_TTL_MS + 1000);
    expect(await reset.checkLocalReset(EMAIL, code)).toMatchObject({ ok: false, kind: "code_expired" });
  });

  it("a newer code replaces the older one", async () => {
    await reset.issueLocalReset(EMAIL);
    const first = lastCode();
    await reset.issueLocalReset(EMAIL);
    const second = lastCode();
    if (first !== second) expect(await reset.checkLocalReset(EMAIL, first)).toMatchObject({ ok: false });
    expect(await reset.checkLocalReset(EMAIL, second)).toMatchObject({ ok: true });
  });
});
