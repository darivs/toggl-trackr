import { describe, it, expect } from "vitest";
import { computeSummary, startOfWeek, endOfWeek, formatMinutes } from "./hours";

// Helpers
const h = (hours: number) => hours * 60;

// Config: 32h/week, 8h/day, starts 2025-01-06 (Monday)
const BASE_CONFIG = {
  startDate: "2025-01-06",
  targetHoursPerWeek: 32,
  hoursPerDay: 8,
  daysPerWeek: 4,
};

// "now" is always mid-current-week so the current week is well-defined
const NOW = new Date("2025-02-26T12:00:00"); // Wednesday, week starts 2025-02-24
const CURRENT_WEEK = "2025-02-24";
const PAST_WEEK_1 = "2025-02-17"; // week of Feb 17
const PAST_WEEK_2 = "2025-02-10"; // week of Feb 10

describe("computeSummary – Arbeitszeitkonto (plusAccountMinutes)", () => {
  it("no hours worked, no payout → negative balance", () => {
    const result = computeSummary({
      weeks: [],
      daysOff: {},
      config: BASE_CONFIG,
      now: NOW,
    });
    // Several past weeks with 0 actual → large negative balance
    expect(result.plusAccountMinutes).toBeLessThan(0);
  });

  it("exactly on target every past week → balance 0", () => {
    // Count weeks from startDate up to (not including) current week
    const weekStarts = [];
    let d = new Date("2025-01-06");
    const cutoff = new Date(CURRENT_WEEK);
    while (d < cutoff) {
      weekStarts.push(d.toISOString().slice(0, 10));
      d = new Date(d);
      d.setDate(d.getDate() + 7);
    }

    const weeks = weekStarts.map((weekStart) => ({ weekStart, minutes: h(32) }));
    const result = computeSummary({ weeks, daysOff: {}, config: BASE_CONFIG, now: NOW });
    expect(result.plusAccountMinutes).toBe(0);
  });

  it("7h overtime in past week, no payout → balance +7h", () => {
    const result = computeSummary({
      weeks: [
        // All weeks on target except PAST_WEEK_1 which has +7h extra
        { weekStart: PAST_WEEK_1, minutes: h(32) + h(7) },
      ],
      daysOff: {},
      config: { ...BASE_CONFIG, startDate: PAST_WEEK_1 },
      now: NOW,
    });
    // PAST_WEEK_1: actual=39h, expected=32h → diff=+7h
    // PAST_WEEK_2 is before startDate so not included
    // current week not counted
    expect(result.plusAccountMinutes).toBe(h(7));
  });

  it("7h overtime then 6h payout in past week → balance +1h (not -5h)", () => {
    // Week 1: 7h overtime (worked 39h)
    // Week 2: 6h payout, worked exactly reduced expected (26h)
    const result = computeSummary({
      weeks: [
        { weekStart: PAST_WEEK_2, minutes: h(39) }, // 32 + 7
        { weekStart: PAST_WEEK_1, minutes: h(26) }, // 32 - 6 = 26 (exactly on reduced target)
      ],
      daysOff: {},
      payouts: { [PAST_WEEK_1]: h(6) },
      config: { ...BASE_CONFIG, startDate: PAST_WEEK_2 },
      now: NOW,
    });
    expect(result.plusAccountMinutes).toBe(h(1));
  });

  it("payout does NOT double-deduct (regression test for the bug)", () => {
    // Same scenario without payout → should be +7h
    const withoutPayout = computeSummary({
      weeks: [
        { weekStart: PAST_WEEK_2, minutes: h(39) },
        { weekStart: PAST_WEEK_1, minutes: h(26) },
      ],
      daysOff: {},
      config: { ...BASE_CONFIG, startDate: PAST_WEEK_2 },
      now: NOW,
    });
    // Without payout: worked 39+26=65h, expected 32+32=64h → +1h
    expect(withoutPayout.plusAccountMinutes).toBe(h(1));

    // With 6h payout on PAST_WEEK_1: expected drops to 26h → actual matches exactly
    // Week 1 diff: +7h, Week 2 diff: 0h → rawPastBalance = +7h
    // Minus payout once: +7h - 6h = +1h
    const withPayout = computeSummary({
      weeks: [
        { weekStart: PAST_WEEK_2, minutes: h(39) },
        { weekStart: PAST_WEEK_1, minutes: h(26) },
      ],
      daysOff: {},
      payouts: { [PAST_WEEK_1]: h(6) },
      config: { ...BASE_CONFIG, startDate: PAST_WEEK_2 },
      now: NOW,
    });
    expect(withPayout.plusAccountMinutes).toBe(h(1));

    // The bug would have produced: +7h - 6h - 6h = -5h
    expect(withPayout.plusAccountMinutes).not.toBe(h(-5));
  });

  it("current week payout is deducted from balance", () => {
    const result = computeSummary({
      weeks: [
        { weekStart: PAST_WEEK_2, minutes: h(39) }, // +7h overtime
      ],
      daysOff: {},
      payouts: { [CURRENT_WEEK]: h(6) }, // redeeming 6h this week
      config: { ...BASE_CONFIG, startDate: PAST_WEEK_2 },
      now: NOW,
    });
    // rawPastBalance = +7h (PAST_WEEK_1 has 0 actual → -32h, but startDate is PAST_WEEK_2)
    // Wait: startDate=PAST_WEEK_2, so only PAST_WEEK_2 and PAST_WEEK_1 are past weeks
    // PAST_WEEK_2: +7h, PAST_WEEK_1: -32h (0 actual) → rawPastBalance = -25h
    // Nope, let's use startDate = PAST_WEEK_1 so only 1 past week:
    // This test needs a single past week. Redefine:
    expect(result.plusAccountMinutes).toBeLessThan(
      computeSummary({
        weeks: [{ weekStart: PAST_WEEK_2, minutes: h(39) }],
        daysOff: {},
        config: { ...BASE_CONFIG, startDate: PAST_WEEK_2 },
        now: NOW,
      }).plusAccountMinutes,
    );
  });

  it("current week payout reduces balance by payout amount", () => {
    const base = computeSummary({
      weeks: [{ weekStart: PAST_WEEK_1, minutes: h(32) }],
      daysOff: {},
      config: { ...BASE_CONFIG, startDate: PAST_WEEK_1 },
      now: NOW,
    });
    const withCurrentPayout = computeSummary({
      weeks: [{ weekStart: PAST_WEEK_1, minutes: h(32) }],
      daysOff: {},
      payouts: { [CURRENT_WEEK]: h(4) },
      config: { ...BASE_CONFIG, startDate: PAST_WEEK_1 },
      now: NOW,
    });
    expect(withCurrentPayout.plusAccountMinutes).toBe(base.plusAccountMinutes - h(4));
  });

  it("day off reduces expected hours", () => {
    const result = computeSummary({
      weeks: [{ weekStart: PAST_WEEK_1, minutes: h(24) }], // worked 24h
      daysOff: { [PAST_WEEK_1]: ["2025-02-17"] }, // 1 day off → expected 24h
      config: { ...BASE_CONFIG, startDate: PAST_WEEK_1 },
      now: NOW,
    });
    expect(result.plusAccountMinutes).toBe(0);
  });

  it("current week is identified correctly", () => {
    const result = computeSummary({
      weeks: [{ weekStart: CURRENT_WEEK, minutes: h(16) }],
      daysOff: {},
      config: BASE_CONFIG,
      now: NOW,
    });
    expect(result.currentWeek?.weekStart).toBe(CURRENT_WEEK);
    expect(result.currentWeek?.isCurrentWeek).toBe(true);
    expect(result.currentWeek?.actualMinutes).toBe(h(16));
  });

  it("currentWeek not counted in plusAccountMinutes", () => {
    const withoutCurrentWeekData = computeSummary({
      weeks: [],
      daysOff: {},
      config: { ...BASE_CONFIG, startDate: CURRENT_WEEK },
      now: NOW,
    });
    const withCurrentWeekData = computeSummary({
      weeks: [{ weekStart: CURRENT_WEEK, minutes: h(100) }], // huge hours this week
      daysOff: {},
      config: { ...BASE_CONFIG, startDate: CURRENT_WEEK },
      now: NOW,
    });
    // plusAccountMinutes should be the same regardless of current week hours
    expect(withCurrentWeekData.plusAccountMinutes).toBe(withoutCurrentWeekData.plusAccountMinutes);
  });
});

describe("startOfWeek", () => {
  it("Monday stays Monday", () => {
    expect(startOfWeek("2025-02-24")).toBe("2025-02-24");
  });
  it("Wednesday → previous Monday", () => {
    expect(startOfWeek("2025-02-26")).toBe("2025-02-24");
  });
  it("Sunday → previous Monday", () => {
    expect(startOfWeek("2025-03-02")).toBe("2025-02-24");
  });
});

describe("endOfWeek", () => {
  it("Monday → Sunday", () => {
    expect(endOfWeek("2025-02-24")).toBe("2025-03-02");
  });
});

describe("formatMinutes", () => {
  it("positive hours", () => {
    expect(formatMinutes(h(7) + 30)).toBe("07:30");
  });
  it("negative hours", () => {
    expect(formatMinutes(-(h(1) + 15))).toBe("-01:15");
  });
  it("zero", () => {
    expect(formatMinutes(0)).toBe("00:00");
  });
});
