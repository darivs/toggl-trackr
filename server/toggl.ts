import fetch from "node-fetch";

export type TogglEntry = {
  id?: number;
  start: string;
  stop?: string | null;
  duration?: number; // seconds
  description?: string;
  workspace_id?: number;
};

export type WeekSummary = {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Sunday)
  minutes: number;
};

const authHeader = (token: string) => ({
  Authorization: `Basic ${Buffer.from(`${token}:api_token`).toString("base64")}`,
});

const toISODateLocal = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export async function fetchMyTimeEntries(opts: {
  token: string;
  startDate: string; // YYYY-MM-DD oder RFC3339
  endDate: string; // YYYY-MM-DD oder RFC3339
  meUrl?: string; // base me endpoint, defaults to official Toggl API
}): Promise<TogglEntry[]> {
  const { token, startDate, endDate, meUrl } = opts;

  const baseMeUrl = meUrl ?? "https://api.track.toggl.com/api/v9/me";
  const url = new URL(`${baseMeUrl.replace(/\/$/, "")}/time_entries`);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  const res = await fetch(url, { headers: authHeader(token) });
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (!res.ok) throw new Error(`Toggl API responded ${res.status} ${res.statusText}`);

  const body = await res.json();

  return Array.isArray(body) ? body : [];
}

// Lightweight sample data for testing mode
export function sampleTimeEntries(): TogglEntry[] {
  return [
    // Week 0 (Mon 2025-12-29) ~32h
    { start: "2025-12-29T08:00:00Z", stop: "2025-12-29T16:00:00Z" },
    { start: "2025-12-30T08:00:00Z", stop: "2025-12-30T16:00:00Z" },
    { start: "2025-12-31T08:00:00Z", stop: "2025-12-31T16:00:00Z" },
    { start: "2026-01-02T08:00:00Z", stop: "2026-01-02T16:00:00Z" },
    // Week 1 (Mon 2026-01-05) ~34h
    { start: "2026-01-05T08:00:00Z", stop: "2026-01-05T16:30:00Z" },
    { start: "2026-01-06T08:00:00Z", stop: "2026-01-06T16:30:00Z" },
    { start: "2026-01-07T08:00:00Z", stop: "2026-01-07T16:30:00Z" },
    { start: "2026-01-08T08:00:00Z", stop: "2026-01-08T16:30:00Z" },
    // Week 2 (Mon 2026-01-12) ~36h
    { start: "2026-01-12T08:00:00Z", stop: "2026-01-12T17:00:00Z" },
    { start: "2026-01-13T08:00:00Z", stop: "2026-01-13T17:00:00Z" },
    { start: "2026-01-14T08:00:00Z", stop: "2026-01-14T17:00:00Z" },
    { start: "2026-01-15T08:00:00Z", stop: "2026-01-15T17:00:00Z" },
    // Week 3 (Mon 2026-01-19) ~33h
    { start: "2026-01-19T08:00:00Z", stop: "2026-01-19T16:00:00Z" },
    { start: "2026-01-20T08:30:00Z", stop: "2026-01-20T16:00:00Z" },
    { start: "2026-01-21T08:00:00Z", stop: "2026-01-21T16:00:00Z" },
    { start: "2026-01-22T08:00:00Z", stop: "2026-01-22T13:00:00Z" },
    // Week 4 (Mon 2026-01-26) ~31h
    { start: "2026-01-26T08:00:00Z", stop: "2026-01-26T16:00:00Z" },
    { start: "2026-01-27T08:00:00Z", stop: "2026-01-27T16:00:00Z" },
    { start: "2026-01-28T08:00:00Z", stop: "2026-01-28T15:00:00Z" },
    { start: "2026-01-29T08:30:00Z", stop: "2026-01-29T22:30:00Z" },
    // Week 5 (Mon 2026-02-02) ~37h30m
    { start: "2026-02-02T08:00:00Z", stop: "2026-02-02T17:00:00Z" },
    { start: "2026-02-03T08:00:00Z", stop: "2026-02-03T17:00:00Z" },
    { start: "2026-02-04T08:00:00Z", stop: "2026-02-04T17:00:00Z" },
    { start: "2026-02-05T08:00:00Z", stop: "2026-02-05T10:30:00Z" },
  ];
}

export function aggregateByWeek(entries: TogglEntry[]): WeekSummary[] {
  const weeks = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.start) continue;
    const start = new Date(entry.start);
    const stop = entry.stop ? new Date(entry.stop) : null;
    const durationSeconds = entry.duration ?? (stop ? (stop.getTime() - start.getTime()) / 1000 : 0);
    const minutes = Math.max(0, Math.round(durationSeconds / 60));
    const weekStart = startOfWeek(start);
    weeks.set(weekStart, (weeks.get(weekStart) ?? 0) + minutes);
  }

  return Array.from(weeks.entries())
    .map(([weekStart, minutes]) => ({
      weekStart,
      weekEnd: endOfWeek(weekStart),
      minutes,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function startOfWeek(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : new Date(dateInput);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMonday);

  return toISODateLocal(d);
}

export function endOfWeek(weekStartISO: string): string {
  const d = new Date(weekStartISO + "T00:00:00");
  d.setDate(d.getDate() + 6);

  return toISODateLocal(d);
}
