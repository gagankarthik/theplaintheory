"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure } from "@/lib/action-result";
import { requireProperty } from "@/lib/auth/access";
import { SCAN_FREQUENCIES, SCAN_FREQUENCY_LABEL, scheduleFor, type ScanFrequencyChoice } from "@/lib/scan-schedule";
import { auditSite } from "@/lib/site-config";

export type ScanScheduleResult = { ok: string; frequency: ScanFrequencyChoice; nextDueAt: string | null } | { error: string };

const FREQUENCY = z.enum(SCAN_FREQUENCIES);

/** Turn automatic tracker scans off, or run them weekly or monthly (needs property:write). */
export async function setScanSchedule(propertyId: string, frequency: ScanFrequencyChoice): Promise<ScanScheduleResult> {
  try {
    const ctx = await requireProperty(propertyId, "property:write");
    const choice = FREQUENCY.parse(frequency);
    const current = ctx.property.scanSchedule;
    const from: ScanFrequencyChoice = current?.frequency ?? "off";
    const next = scheduleFor(choice, current, new Date());
    if (from !== choice) {
      await ctx.store.updateProperty(ctx.property.id, { scanSchedule: next ?? undefined });
      await auditSite(ctx, "tracker.scan_schedule_changed", { from, to: choice, nextDueAt: next?.nextDueAt ?? null });
      revalidatePath(`/app/sites/${propertyId}/scanner`);
    }
    return {
      ok: choice === "off" ? "Automatic scans are off." : `${SCAN_FREQUENCY_LABEL[choice]} scans are on.`,
      frequency: choice,
      nextDueAt: next?.nextDueAt ?? null,
    };
  } catch (e) {
    return { error: failure(e)?.error ?? "The schedule couldn't be saved. Try again." };
  }
}
