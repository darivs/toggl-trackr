export type WeekSummary = {
  weekStart: string; // ISO date Monday
  weekEnd: string; // ISO date Sunday
  minutes: number; // tracked minutes in that calendar week
};

export type DaysOffMap = Record<string, number[]>; // weekStart -> weekday indices (0=Mon)

export type Config = {
  startDate: string;
  targetHoursPerWeek: number;
  hoursPerDay: number;
  daysPerWeek: number;
  testMode?: boolean;
  dataEndDate?: string;
  togglTokenConfigured?: boolean;
  togglTokenSource?: "store" | "env" | "none";
  needsTogglToken?: boolean;
  googleClientId?: string;
};

export type ComputedWeek = {
  weekStart: string;
  weekEnd: string;
  actualMinutes: number;
  expectedMinutes: number;
  diffMinutes: number;
  daysOff: number[];
  isCurrentWeek: boolean;
  payoutMinutes: number;
};

export type ComputedResult = {
  plusAccountMinutes: number;
  currentWeek?: ComputedWeek;
  weeks: ComputedWeek[];
};

export type PayoutsMap = Record<string, number>; // weekStart -> minutes

export type AuthUser = {
  email: string;
  name?: string | null;
  picture?: string | null;
};
