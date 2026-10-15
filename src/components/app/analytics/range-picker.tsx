"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Segmented } from "@/components/app/ui/tabs";

/** The overview's date range, kept in the URL (?range=) so a link or a reload shows the same window. */
export function RangePicker({ value, options }: { value: number; options: readonly number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  return (
    <div aria-busy={pending || undefined} className={`transition-opacity duration-150 ${pending ? "opacity-70" : ""}`}>
      <Segmented
        label="Date range, days in UTC"
        value={String(value)}
        onChange={(v) => start(() => router.push(`${pathname}?range=${v}`, { scroll: false }))}
        options={options.map((r) => ({ value: String(r), label: `${r} days`, title: `Last ${r} days, in UTC` }))}
      />
    </div>
  );
}
