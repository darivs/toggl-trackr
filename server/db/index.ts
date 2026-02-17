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
      user_id INTEGER NOT NULL REFERENCES users(id),
      week_start TEXT NOT NULL,
      day_index INTEGER NOT NULL,
      UNIQUE(user_id, week_start, day_index)
    )
  `);

  // Migration: add user_id column if table existed without it
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'days_off' AND column_name = 'user_id'
      ) THEN
        -- Drop old data (no user association possible)
        DELETE FROM days_off;
        ALTER TABLE days_off ADD COLUMN user_id INTEGER NOT NULL REFERENCES users(id);
        -- Replace old unique constraint with new one
        ALTER TABLE days_off DROP CONSTRAINT IF EXISTS days_off_week_start_day_index_unique;
        ALTER TABLE days_off ADD CONSTRAINT days_off_user_id_week_start_day_index_unique UNIQUE(user_id, week_start, day_index);
      END IF;
    END $$;
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

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payouts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      week_start TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      UNIQUE(user_id, week_start)
    )
  `);

  console.log("Migrations complete.");
}

export { schema };
