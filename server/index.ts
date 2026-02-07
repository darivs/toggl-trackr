import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs/promises";
import jwt from "jsonwebtoken";
import path from "path";
import { OAuth2Client } from "google-auth-library";
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
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN; // optional for custom domain
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : ["http://localhost:51731", "http://localhost:5173"];
// Workspace/Org-Konfiguration nicht mehr nötig, wir lesen immer "me"-Einträge
const TARGET_HOURS_PER_WEEK = Number(process.env.TARGET_HOURS_PER_WEEK ?? 32);
const HOURS_PER_DAY = Number(process.env.HOURS_PER_DAY ?? 8);
const DAYS_PER_WEEK = Number(process.env.DAYS_PER_WEEK ?? 4);
const oAuthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const app = express();
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

export type AppStore = {
  daysOff: Record<string, number[]>; // weekStart -> weekday indices (0=Mon)
  togglApiToken?: string | null;
};

const defaultStore: AppStore = { daysOff: {}, togglApiToken: null };

type AuthPayload = {
  email: string;
  name?: string | null;
  picture?: string | null;
};

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Request {
      cookies?: Record<string, string>;
      user?: AuthPayload;
    }
  }
}

async function readStore(): Promise<AppStore> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppStore> & { daysOff?: Record<string, number[]> };

    return {
      ...defaultStore,
      ...(parsed ?? {}),
      daysOff: parsed?.daysOff ?? {},
      togglApiToken: parsed?.togglApiToken ?? null,
    } satisfies AppStore;
  } catch (readError) {
    console.error(readError);

    return defaultStore;
  }
}

async function writeStore(store: AppStore): Promise<void> {
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

const setAuthCookie = (res: Response, payload: AuthPayload) => {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  res.cookie("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    domain: COOKIE_DOMAIN,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.session;
  if (!token) return res.status(401).json({ error: "Unauthenticated" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid session" });
  }
};

app.get(
  "/api/config",
  asyncHandler(async (_req, res) => {
    const sample = TEST_MODE ? sampleTimeEntries() : null;
    const bounds = sample ? sampleBounds(sample) : null;
    const store = await readStore();
    const tokenSource = store.togglApiToken ? "store" : TOGGL_API_TOKEN ? "env" : "none";
    const tokenConfigured = tokenSource !== "none";

    res.json({
      startDate: bounds?.start ?? START_DATE,
      targetHoursPerWeek: TARGET_HOURS_PER_WEEK,
      hoursPerDay: HOURS_PER_DAY,
      daysPerWeek: DAYS_PER_WEEK,
      testMode: TEST_MODE,
      dataEndDate: bounds?.end,
      togglTokenConfigured: tokenConfigured,
      togglTokenSource: tokenSource,
      needsTogglToken: !TEST_MODE && !tokenConfigured,
    });
  })
);

app.get(
  "/api/days-off",
  authMiddleware,
  asyncHandler(async (_req, res) => {
    const store = await readStore();
    res.json({ daysOff: store.daysOff });
  })
);

app.put(
  "/api/days-off",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { weekStart, daysOff } = req.body ?? {};
    if (typeof weekStart !== "string" || !Array.isArray(daysOff)) {
      return res.status(400).json({ error: "weekStart (string) and daysOff (array) are required" });
    }

    const sanitized = Array.from(new Set(daysOff.map(Number).filter((n) => n >= 0 && n < 7))).sort();
    const store = await readStore();
    const next = { ...store, daysOff: { ...store.daysOff, [weekStart]: sanitized } } satisfies AppStore;
    await writeStore(next);
    res.json({ daysOff: next.daysOff });
  })
);

app.get(
  "/api/hours",
  authMiddleware,
  asyncHandler(async (_req, res) => {
    const store = await readStore();
    const token = store.togglApiToken || TOGGL_API_TOKEN;
    if (!token && !TEST_MODE) {
      return res.status(400).json({ error: "TOGGL_API_TOKEN fehlt. Bitte im Frontend hinterlegen." });
    }

    const entries = TEST_MODE
      ? sampleTimeEntries()
      : await fetchMyTimeEntries({
          token: token ?? "",
          startDate: START_DATE,
          meUrl: TOGGL_API_ME_URL,
          endDate: new Date().toISOString(),
        });

    const weeks: WeekSummary[] = aggregateByWeek(entries);
    res.json({ weeks });
  })
);

app.post(
  "/api/auth/google",
  asyncHandler(async (req, res) => {
    if (!oAuthClient || !GOOGLE_CLIENT_ID) return res.status(500).json({ error: "Missing GOOGLE_CLIENT_ID" });
    const { credential } = req.body ?? {};
    if (typeof credential !== "string") return res.status(400).json({ error: "credential is required" });

    const ticket = await oAuthClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(401).json({ error: "E-Mail fehlt im Token" });

    const user: AuthPayload = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    setAuthCookie(res, user);
    res.json({ user });
  })
);

app.get(
  "/api/toggl-token",
  authMiddleware,
  asyncHandler(async (_req, res) => {
    const store = await readStore();
    const source = store.togglApiToken ? "store" : TOGGL_API_TOKEN ? "env" : "none";
    res.json({ configured: source !== "none", source });
  })
);

app.post(
  "/api/toggl-token",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ error: "token is required" });
    }

    const store = await readStore();
    const next = { ...store, togglApiToken: token.trim() } satisfies AppStore;
    await writeStore(next);

    res.json({ configured: true, source: "store" });
  })
);

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    domain: COOKIE_DOMAIN,
  });
  res.json({ ok: true });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthenticated" });
  res.json({ user });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
