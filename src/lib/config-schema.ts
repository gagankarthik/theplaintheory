import { z } from "zod";

/**
 * Validation for banner configuration, shared by every server action that writes it. Unknown keys
 * are stripped, so anything not described here is never stored.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colors must be 6-digit hex values like #2E2BD6.");
/** Button labels allow 60 characters: the CCPA opt-out's statutory wording alone is 47. */
const label = z.string().trim().min(1).max(60);
const copySchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(600),
  acceptAll: label,
  rejectAll: label,
  customize: label,
  save: label,
  policyLabel: label,
});
const LANGUAGE_CODES = [
  "en", "as", "bn", "brx", "doi", "gu", "hi", "kn", "ks", "kok", "mai", "ml", "mni", "mr", "ne", "or", "pa", "sa", "sat", "sd", "ta", "te", "ur",
  "de", "fr", "es", "it", "nl", "pt",
] as const;
export const languageCodeSchema = z.enum(LANGUAGE_CODES);
const categoryText = z.object({ label: z.string().trim().min(1).max(40), description: z.string().trim().min(1).max(300) });
export const translationSchema = z.object({
  copy: copySchema,
  categories: z.object({ essential: categoryText, functional: categoryText, analytics: categoryText, marketing: categoryText }).partial().optional(),
  status: z.enum(["draft", "reviewed"]),
  reviewedBy: z.string().trim().max(120).optional(),
  reviewedAt: z.string().max(40).optional(),
});
const regionSchema = z.object({
  framework: z.enum(["gdpr", "ccpa", "dpdpa", "generic"]),
  enabled: z.boolean(),
  model: z.enum(["opt-in", "opt-out"]),
  copy: copySchema,
  language: z.string().min(2).max(8),
  translations: z.partialRecord(languageCodeSchema, translationSchema).optional(),
});
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.url("Links must be full URLs starting with https://").optional());
export const rightsSchema = z.object({
  rightsUrl: optionalUrl,
  grievanceEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.email("Enter a valid email address for grievances.").optional()),
  boardComplaintUrl: optionalUrl,
});
export const configSchema = z.object({
  theme: z.object({
    layout: z.enum(["bar", "modal", "toast"]),
    position: z.enum(["bottom", "top", "bottom-left", "bottom-right", "center"]),
    background: hex,
    text: hex,
    accent: hex,
    accentText: hex,
    radius: z.number().int().min(0).max(28),
    font: z.enum(["system", "inherit", "serif", "mono"]),
    equalButtons: z.boolean(),
    fabSide: z.enum(["left", "right"]).optional(),
  }),
  categories: z
    .array(
      z.object({
        id: z.enum(["essential", "functional", "analytics", "marketing"]),
        label: z.string().trim().min(1).max(40),
        description: z.string().trim().min(1).max(300),
        required: z.boolean(),
        dataItems: z.array(z.string().trim().min(1).max(80)).max(15, "List at most 15 data items per purpose.").optional(),
        retention: z.string().trim().max(80).optional(),
      }),
    )
    .length(4),
  regions: z.object({ gdpr: regionSchema, ccpa: regionSchema, dpdpa: regionSchema, generic: regionSchema }),
  policyUrl: z.url("The policy link must be a full URL starting with https://"),
  headless: z.boolean(),
  googleConsentMode: z.boolean(),
  expiryDays: z.number().int().min(1).max(395),
  reaskAfterRejectDays: z.number().int().min(0).max(395).optional(),
  rights: rightsSchema.optional(),
  leakDetection: z.boolean().optional(),
});
