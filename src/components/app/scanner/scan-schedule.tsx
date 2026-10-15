"use client";

import { useState, useTransition } from "react";
import { setScanSchedule } from "@/app/app/sites/[propertyId]/scan-schedule-actions";
import { Alert } from "@/components/app/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { DateText } from "@/components/app/ui/date-text";
import { SelectField } from "@/components/app/ui/field";
import type { SelectOption } from "@/components/app/ui/select";
import { useToast } from "@/components/app/ui/toast";
import { scheduledRunAt, type ScanFrequencyChoice } from "@/lib/scan-schedule";

const OPTIONS: SelectOption<ScanFrequencyChoice>[] = [
  { value: "off", label: "Off", description: "Scan only when you choose Scan now" },
  { value: "weekly", label: "Weekly", description: "Every 7 days" },
  { value: "monthly", label: "Monthly", description: "Same day each month" },
];

/**
 * Automatic scans: Off, Weekly or Monthly. Saves as soon as a choice is made (success as a toast,
 * errors inline) and shows when the next scheduled scan is due.
 */
export function ScanScheduleCard({
  propertyId,
  canWrite,
  frequency: initialFrequency,
  nextDueAt: initialNext,
  lastRunAt,
}: {
  propertyId: string;
  canWrite: boolean;
  frequency: ScanFrequencyChoice;
  nextDueAt: string | null;
  lastRunAt?: string;
}) {
  const toast = useToast();
  const [frequency, setFrequency] = useState(initialFrequency);
  const [nextDueAt, setNextDueAt] = useState(initialNext);
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  const change = (value: ScanFrequencyChoice) => {
    if (value === frequency) return;
    const previous = frequency;
    setFrequency(value);
    setError(null);
    startTransition(async () => {
      const r = await setScanSchedule(propertyId, value);
      if ("error" in r) {
        setFrequency(previous);
        setError(r.error);
        return;
      }
      setNextDueAt(r.nextDueAt);
      toast(r.ok);
    });
  };

  return (
    <Card aria-labelledby="schedule-h">
      <CardHeader titleId="schedule-h" title="Automatic scans" description="Rescan on a schedule so new trackers reach the catalog." />
      <CardBody className="space-y-3">
        <SelectField<ScanFrequencyChoice>
          id="scan-frequency"
          label="Frequency"
          options={OPTIONS}
          value={frequency}
          onValueChange={change}
          disabled={!canWrite || saving}
          menuWidth={288}
          hint={!canWrite ? "Only members who can edit this site can change the schedule." : undefined}
        />
        <p className="text-sm text-ink-2" aria-live="polite">
          {frequency !== "off" && nextDueAt ? (
            <>
              Next around <DateText iso={scheduledRunAt(nextDueAt)} mode="datetime" className="font-medium text-ink" />
            </>
          ) : (
            <span className="text-ink-3">No scheduled scans.</span>
          )}
          {lastRunAt && frequency !== "off" ? (
            <span className="block text-xs text-ink-3">
              Last ran <DateText iso={lastRunAt} mode="date" />
            </span>
          ) : null}
        </p>
        {error ? (
          <Alert tone="danger" title="The schedule wasn't saved.">
            {error}
          </Alert>
        ) : null}
      </CardBody>
    </Card>
  );
}
