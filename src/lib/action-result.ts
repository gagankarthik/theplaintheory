import { z } from "zod";

/** Uniform result for every server action: a success message, a summary error, and per-field errors. */
export type ActionResult = {
  ok?: string;
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
} | null;

export function invalid(err: z.ZodError, summary = "Fix the highlighted fields and try again."): ActionResult {
  const flat = z.flattenError(err);
  const fieldErrors = flat.fieldErrors as Partial<Record<string, string[]>>;
  const only = Object.values(fieldErrors).flat().filter(Boolean);
  return { error: only.length === 1 ? only[0] : summary, fieldErrors };
}

export function failure(e: unknown): ActionResult {
  // Next's redirect()/notFound() throw control-flow errors that must propagate.
  if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && /^NEXT_/.test((e as { digest: string }).digest)) throw e;
  return { error: e instanceof Error ? e.message : "Something went wrong. Try again." };
}
