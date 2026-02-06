import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { aggregateByWeek, fetchMyTimeEntries, sampleTimeEntries, WeekSummary, TogglEntry } from "./toggl.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, "data.json");
const PORT = 43001;
const START_DATE = process.env.START_DATE ?? "2026-01-01";
const TOGGL_API_TOKEN = process.env.TOGGL_API_TOKEN ?? "";
const TOGGL_API_ME_URL = process.env.TOGGL_API_ME_URL ?? "https://api.track.toggl.com/api/v9/me";
const TEST_MODE = process.env.TEST_MODE === "true";
// Workspace/Org-Konfiguration nicht mehr nötig, wir lesen immer "me"-Einträge
const TARGET_HOURS_PER_WEEK = Number(process.env.TARGET_HOURS_PER_WEEK ?? 32);
const HOURS_PER_DAY = Number(process.env.HOURS_PER_DAY ?? 8);
const DAYS_PER_WEEK = Number(process.env.DAYS_PER_WEEK ?? 4);

const app = express();
app.use(cors());
app.use(express.json());

export type DaysOffStore = {
  daysOff: Record<string, number[]>; // weekStart -> weekday indices (0=Mon)
};

const defaultStore: DaysOffStore = { daysOff: {} };

async function readStore(): Promise<DaysOffStore> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as DaysOffStore;

    return parsed?.daysOff ? parsed : defaultStore;
  } catch (readError) {
    console.error(readError);

    return defaultStore;
  }
}

async function writeStore(store: DaysOffStore): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function toISODateLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sampleBounds(entries: TogglEntry[]) {
  const timestamps = entries
    .flatMap((e) => [e.start, e.stop].filter(Boolean))
    .map((t) => new Date(String(t)).getTime());
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  const start = toISODateLocal(new Date(min));
  const end = toISODateLocal(new Date(max));

  return { start, end };
}

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };

app.get("/api/config", (_req, res) => {
  const sample = TEST_MODE ? sampleTimeEntries() : null;
  const bounds = sample ? sampleBounds(sample) : null;
  res.json({
    startDate: bounds?.start ?? START_DATE,
    targetHoursPerWeek: TARGET_HOURS_PER_WEEK,
    hoursPerDay: HOURS_PER_DAY,
    daysPerWeek: DAYS_PER_WEEK,
    testMode: TEST_MODE,
    dataEndDate: bounds?.end,
  });
});

app.get(
  "/api/days-off",
  asyncHandler(async (_req, res) => {
    const store = await readStore();
    res.json(store);
  })
);

app.put(
  "/api/days-off",
  asyncHandler(async (req, res) => {
    const { weekStart, daysOff } = req.body ?? {};
    if (typeof weekStart !== "string" || !Array.isArray(daysOff)) {
      return res.status(400).json({ error: "weekStart (string) and daysOff (array) are required" });
    }

    const sanitized = Array.from(new Set(daysOff.map(Number).filter((n) => n >= 0 && n < 7))).sort();
    const store = await readStore();
    store.daysOff[weekStart] = sanitized;
    await writeStore(store);
    res.json(store);
  })
);

app.get(
  "/api/hours",
  asyncHandler(async (_req, res) => {
    if (!TOGGL_API_TOKEN && !TEST_MODE) {
      return res.status(500).json({ error: "Missing TOGGL_API_TOKEN in environment" });
    }

    const entries = TEST_MODE
      ? sampleTimeEntries()
      : await fetchMyTimeEntries({
          token: TOGGL_API_TOKEN,
          startDate: START_DATE,
          meUrl: TOGGL_API_ME_URL,
          endDate: new Date().toISOString(),
        });

    const weeks: WeekSummary[] = aggregateByWeek(entries);
    res.json({ weeks });
  })
);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
