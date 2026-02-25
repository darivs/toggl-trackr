export type { WeekSummary, DaysOffMap, Config, ComputedWeek, ComputedResult, PayoutsMap } from "../types";
import type { WeekSummary, DaysOffMap, Config, ComputedWeek, ComputedResult, PayoutsMap } from "../types";

const DEFAULT_CONFIG: Config = {
  startDate: "2025-01-05",
  targetHoursPerWeek: 32,
  hoursPerDay: 8,
  daysPerWeek: 4,
  testMode: false,
};

export function startOfWeek(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : new Date(dateInput);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMonday);

  return formatLocalISODate(d);
}

export function endOfWeek(weekStartISO: string): string {
  const d = new Date(weekStartISO + "T00:00:00");
  d.setDate(d.getDate() + 6);

  return formatLocalISODate(d);
}

function formatLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function enumerateWeekStarts(startDate: string, endDate: Date): string[] {
  const starts: string[] = [];
  let cursor = new Date(startOfWeek(startDate));
  const end = new Date(startOfWeek(endDate));
  while (cursor <= end) {
    starts.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }

  return starts;
}

export function computeSummary(params: {
  weeks: WeekSummary[];
  daysOff: DaysOffMap;
  payouts?: PayoutsMap;
  config?: Partial<Config>;
  now?: Date;
}): ComputedResult {
  const cfg: Config = { ...DEFAULT_CONFIG, ...(params.config ?? {}) };
  const payouts = params.payouts ?? {};
  const inferredNow = cfg.dataEndDate ? new Date(`${cfg.dataEndDate}T23:59:59`) : new Date();
  const now = params.now ?? inferredNow;
  const currentWeekStart = startOfWeek(now);
  const actualByWeek = new Map<string, number>();
  for (const week of params.weeks) {
    actualByWeek.set(week.weekStart, week.minutes);
  }

  const weekStarts = enumerateWeekStarts(cfg.startDate, now);
  const computed: ComputedWeek[] = weekStarts.map((weekStart) => {
    const actualMinutes = actualByWeek.get(weekStart) ?? 0;
    const offs = params.daysOff[weekStart] ?? [];
    const payout = payouts[weekStart] ?? 0;
    const baseExpected = Math.max(0, (cfg.targetHoursPerWeek - offs.length * cfg.hoursPerDay) * 60);
    const expectedMinutes = Math.max(0, baseExpected - payout);
    const diffMinutes = actualMinutes - expectedMinutes;

    return {
      weekStart,
      weekEnd: endOfWeek(weekStart),
      actualMinutes,
      expectedMinutes,
      diffMinutes,
      daysOff: offs,
      isCurrentWeek: weekStart === currentWeekStart,
      payoutMinutes: payout,
    };
  });

  // diffMinutes is inflated by payouts (reduced expected → higher diff),
  // subtract payoutMinutes to get true overtime per week
  const rawPastBalance = computed
    .filter((week) => week.weekStart < currentWeekStart)
    .reduce((sum, week) => sum + week.diffMinutes - week.payoutMinutes, 0);

  // All payouts (past + current week) are deducted from the account
  const totalPayouts = Object.values(payouts).reduce((sum, m) => sum + m, 0);

  const plusAccountMinutes = rawPastBalance - totalPayouts;

  // Newest first for UI
  const weeks = [...computed].sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  return {
    plusAccountMinutes,
    currentWeek: computed.find((w) => w.isCurrentWeek),
    weeks,
  };
}

export function formatMinutes(minutes: number): string {
  const abs = Math.round(Math.abs(minutes));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const body = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

  return `${minutes < 0 ? "-" : ""}${body}`;
}

export function formatWeekLabel(weekStart: string, weekEnd?: string): string {
  const formatter = new Intl.DateTimeFormat("de-DE", {
    month: "short",
    day: "numeric",
  });
  const start = formatter.format(new Date(weekStart));
  const end = formatter.format(new Date(weekEnd ?? endOfWeek(weekStart)));

  return `${start} – ${end}`;
}

export const WORK_DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
