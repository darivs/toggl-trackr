import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL ?? "postgres://toggl:toggl@localhost:5432/toggl_trackr";

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export async function migrate() {
  console.log("Running database migrations…");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS days_off (
      id SERIAL PRIMARY KEY,
      week_start TEXT NOT NULL,
      day_index INTEGER NOT NULL,
      UNIQUE(week_start, day_index)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toggl_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token TEXT NOT NULL,
      UNIQUE(user_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_configs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      target_hours_per_week REAL,
      hours_per_day REAL,
      days_per_week REAL,
      UNIQUE(user_id)
    )
  `);

  console.log("Migrations complete.");
}

export { schema };
