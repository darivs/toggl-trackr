import { pgTable, serial, text, integer, real, timestamp, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name"),
  picture: text("picture"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const daysOff = pgTable(
  "days_off",
  {
    id: serial("id").primaryKey(),
    weekStart: text("week_start").notNull(),
    dayIndex: integer("day_index").notNull(),
  },
  (t) => [unique().on(t.weekStart, t.dayIndex)]
);

export const togglTokens = pgTable(
  "toggl_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    token: text("token").notNull(),
  },
  (t) => [unique().on(t.userId)]
);

export const userConfigs = pgTable(
  "user_configs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    targetHoursPerWeek: real("target_hours_per_week"),
    hoursPerDay: real("hours_per_day"),
    daysPerWeek: real("days_per_week"),
  },
  (t) => [unique().on(t.userId)]
);
