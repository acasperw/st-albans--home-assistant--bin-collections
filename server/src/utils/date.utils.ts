/** Format a Date as YYYY-MM-DD using local time (avoids toISOString UTC shift). */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayLocalStr(): string {
  return toLocalDateStr(new Date());
}
