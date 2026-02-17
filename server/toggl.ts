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
    // Week 1 (Mon 2026-01-05) 33h47m → +1h47m
    { start: "2026-01-05T08:00:00Z", stop: "2026-01-05T16:23:00Z" },
    { start: "2026-01-06T07:45:00Z", stop: "2026-01-06T16:30:00Z" },
    { start: "2026-01-07T08:15:00Z", stop: "2026-01-07T16:42:00Z" },
    { start: "2026-01-08T08:00:00Z", stop: "2026-01-08T16:12:00Z" },
    // Week 2 (Mon 2026-01-12) 35h18m → +3h18m
    { start: "2026-01-12T07:30:00Z", stop: "2026-01-12T16:45:00Z" },
    { start: "2026-01-13T08:00:00Z", stop: "2026-01-13T17:13:00Z" },
    { start: "2026-01-14T07:50:00Z", stop: "2026-01-14T16:38:00Z" },
    { start: "2026-01-15T08:10:00Z", stop: "2026-01-15T16:42:00Z" },
    // Week 3 (Mon 2026-01-19) 33h25m → +1h25m (has 1h payout in test data)
    { start: "2026-01-19T08:00:00Z", stop: "2026-01-19T16:18:00Z" },
    { start: "2026-01-20T07:55:00Z", stop: "2026-01-20T16:22:00Z" },
    { start: "2026-01-21T08:05:00Z", stop: "2026-01-21T16:35:00Z" },
    { start: "2026-01-22T08:00:00Z", stop: "2026-01-22T16:10:00Z" },
    // Week 4 (Mon 2026-01-26) 34h06m → +2h06m
    { start: "2026-01-26T07:45:00Z", stop: "2026-01-26T16:30:00Z" },
    { start: "2026-01-27T08:00:00Z", stop: "2026-01-27T16:48:00Z" },
    { start: "2026-01-28T08:10:00Z", stop: "2026-01-28T16:25:00Z" },
    { start: "2026-01-29T07:50:00Z", stop: "2026-01-29T16:18:00Z" },
    // Week 5 (Mon 2026-02-02) 33h52m → +1h52m
    { start: "2026-02-02T08:00:00Z", stop: "2026-02-02T16:37:00Z" },
    { start: "2026-02-03T07:40:00Z", stop: "2026-02-03T16:15:00Z" },
    { start: "2026-02-04T08:05:00Z", stop: "2026-02-04T16:28:00Z" },
    { start: "2026-02-05T08:00:00Z", stop: "2026-02-05T16:27:00Z" },
    // Week 6 (Mon 2026-02-09) 33h33m → +1h33m
    { start: "2026-02-09T08:00:00Z", stop: "2026-02-09T16:22:00Z" },
    { start: "2026-02-10T07:50:00Z", stop: "2026-02-10T16:18:00Z" },
    { start: "2026-02-11T08:00:00Z", stop: "2026-02-11T16:45:00Z" },
    { start: "2026-02-12T08:10:00Z", stop: "2026-02-12T16:18:00Z" },
    // Week 7 – current (Mon 2026-02-16) ~17h23m so far
    { start: "2026-02-16T07:45:00Z", stop: "2026-02-16T16:52:00Z" },
    { start: "2026-02-17T08:10:00Z", stop: "2026-02-17T16:26:00Z" },
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
