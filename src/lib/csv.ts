/** RFC 4180 quoting that also neutralises spreadsheet formula injection (=, +, -, @ at the start). */
export function csvCell(v: string | number | boolean | null | undefined) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvRow = (cells: (string | number | boolean | null | undefined)[]) => cells.map(csvCell).join(",");

/** A UTF-8 CSV download with a BOM so Excel reads non-ASCII names correctly. */
export function csvResponse(filename: string, header: string[], rows: string[], footer?: string) {
  const body = "﻿" + [csvRow(header), ...rows].join("\n") + "\n" + (footer ? `# ${footer}\n` : "");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
