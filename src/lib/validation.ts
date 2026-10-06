import { z } from "zod";

/** A bare hostname: strips scheme and path, lowercases, requires a dot-separated TLD. */
export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
  .pipe(z.string().regex(/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/, "Enter a domain like example.com, without https://"));

export const EMAIL_MAX = 254;

/**
 * Trimmed, lowercased email with a length cap (RFC 5321 path limit). `message` should say what to
 * enter, for example "Enter a work email like name@company.com."
 */
export const emailSchema = (message: string) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(EMAIL_MAX, `Use an email address under ${EMAIL_MAX} characters.`)
    .pipe(z.email(message));

/** A trimmed single-line text field with a length range and no links (bots stuff URLs into names). */
export const plainTextSchema = (opts: { min: number; max: number; tooShort: string; tooLong: string; noLinks?: string }) =>
  z
    .string()
    .trim()
    .min(opts.min, opts.tooShort)
    .max(opts.max, opts.tooLong)
    .refine((s) => !/\bhttps?:\/\/|\bwww\.|[<>]/i.test(s), opts.noLinks ?? "Remove links and angle brackets from this field.");
