import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { and, eq } from "drizzle-orm";
import { db, migrate, schema } from "./db/index.js";
import { aggregateByWeek, fetchMyTimeEntries, sampleTimeEntries, WeekSummary, TogglEntry } from "./toggl.js";

dotenv.config();

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

type AuthPayload = {
  email: string;
  name?: string | null;
  picture?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      cookies?: Record<string, string>;
      user?: AuthPayload;
    }
  }
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

async function getUserId(email: string): Promise<number | null> {
  const row = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
    columns: { id: true },
  });
  return row?.id ?? null;
}

async function upsertUser(payload: AuthPayload): Promise<number> {
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, payload.email),
  });
  if (existing) {
    await db
      .update(schema.users)
      .set({ name: payload.name, picture: payload.picture })
      .where(eq(schema.users.id, existing.id));
    return existing.id;
  }
  const [inserted] = await db
    .insert(schema.users)
    .values({ email: payload.email, name: payload.name, picture: payload.picture })
    .returning({ id: schema.users.id });
  return inserted.id;
}

async function resolveUserConfig(email?: string) {
  if (email) {
    const userId = await getUserId(email);
    if (userId) {
      const cfg = await db.query.userConfigs.findFirst({
        where: eq(schema.userConfigs.userId, userId),
      });
      if (cfg) {
        return {
          targetHoursPerWeek: cfg.targetHoursPerWeek ?? TARGET_HOURS_PER_WEEK,
          hoursPerDay: cfg.hoursPerDay ?? HOURS_PER_DAY,
          daysPerWeek: cfg.daysPerWeek ?? DAYS_PER_WEEK,
        };
      }
    }
  }
  return {
    targetHoursPerWeek: TARGET_HOURS_PER_WEEK,
    hoursPerDay: HOURS_PER_DAY,
    daysPerWeek: DAYS_PER_WEEK,
  };
}

async function getUserTogglToken(email: string): Promise<string | null> {
  const userId = await getUserId(email);
  if (!userId) return null;
  const row = await db.query.togglTokens.findFirst({
    where: eq(schema.togglTokens.userId, userId),
  });
  return row?.token ?? null;
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
    return res.status(401).json({ error: "Invalid session:" + err });
  }
};

app.get(
  "/api/config",
  asyncHandler(async (req, res) => {
    const sample = TEST_MODE ? sampleTimeEntries() : null;
    const bounds = sample ? sampleBounds(sample) : null;

    let email: string | undefined;
    const maybeToken = req.cookies?.session;
    if (maybeToken) {
      try {
        const decoded = jwt.verify(maybeToken, JWT_SECRET) as AuthPayload;
        email = decoded.email;
      } catch {
        // ignore invalid cookie for this public route
      }
    }

    const hasUserToken = email ? Boolean(await getUserTogglToken(email)) : false;
    const tokenSource = hasUserToken ? "store" : TOGGL_API_TOKEN ? "env" : "none";
    const tokenConfigured = tokenSource !== "none";
    const userConfig = await resolveUserConfig(email);

    res.json({
      startDate: bounds?.start ?? START_DATE,
      targetHoursPerWeek: userConfig.targetHoursPerWeek,
      hoursPerDay: userConfig.hoursPerDay,
      daysPerWeek: userConfig.daysPerWeek,
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
  asyncHandler(async (req, res) => {
    const userId = await getUserId(req.user!.email);
    if (!userId) return res.status(401).json({ error: "User not found" });

    const rows = await db.select().from(schema.daysOff).where(eq(schema.daysOff.userId, userId));
    const daysOffMap: Record<string, number[]> = {};
    for (const row of rows) {
      if (!daysOffMap[row.weekStart]) daysOffMap[row.weekStart] = [];
      daysOffMap[row.weekStart].push(row.dayIndex);
    }
    for (const key of Object.keys(daysOffMap)) {
      daysOffMap[key].sort((a, b) => a - b);
    }
    res.json({ daysOff: daysOffMap });
  })
);

app.put(
  "/api/days-off",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = await getUserId(req.user!.email);
    if (!userId) return res.status(401).json({ error: "User not found" });

    const { weekStart, daysOff: daysOffInput } = req.body ?? {};
    if (typeof weekStart !== "string" || !Array.isArray(daysOffInput)) {
      return res.status(400).json({ error: "weekStart (string) and daysOff (array) are required" });
    }

    const sanitized = Array.from(new Set(daysOffInput.map(Number).filter((n) => n >= 0 && n < 7))).sort();

    // Delete existing days-off for this user+week, then insert new ones
    await db.delete(schema.daysOff).where(
      and(eq(schema.daysOff.userId, userId), eq(schema.daysOff.weekStart, weekStart))
    );
    if (sanitized.length > 0) {
      await db.insert(schema.daysOff).values(sanitized.map((dayIndex) => ({ userId, weekStart, dayIndex })));
    }

    // Return this user's days-off
    const rows = await db.select().from(schema.daysOff).where(eq(schema.daysOff.userId, userId));
    const daysOffMap: Record<string, number[]> = {};
    for (const row of rows) {
      if (!daysOffMap[row.weekStart]) daysOffMap[row.weekStart] = [];
      daysOffMap[row.weekStart].push(row.dayIndex);
    }
    for (const key of Object.keys(daysOffMap)) {
      daysOffMap[key].sort((a, b) => a - b);
    }
    res.json({ daysOff: daysOffMap });
  })
);

app.put(
  "/api/user-config",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const email = req.user?.email;
    if (!email) return res.status(401).json({ error: "Unauthenticated" });

    const { targetHoursPerWeek, hoursPerDay, daysPerWeek } = req.body ?? {};

    const sanitizeNumber = (val: unknown, fallback: number, { min = 1, max }: { min?: number; max?: number } = {}) => {
      const num = typeof val === "number" ? val : Number(val);
      if (!Number.isFinite(num)) return fallback;
      if (num < min) return min;
      if (typeof max === "number" && num > max) return max;
      return num;
    };

    const nextPrefs = {
      targetHoursPerWeek: sanitizeNumber(targetHoursPerWeek, TARGET_HOURS_PER_WEEK, { min: 1, max: 120 }),
      hoursPerDay: sanitizeNumber(hoursPerDay, HOURS_PER_DAY, { min: 1, max: 24 }),
      daysPerWeek: sanitizeNumber(daysPerWeek, DAYS_PER_WEEK, { min: 1, max: 7 }),
    };

    const userId = await getUserId(email);
    if (!userId) return res.status(401).json({ error: "User not found" });

    const existing = await db.query.userConfigs.findFirst({
      where: eq(schema.userConfigs.userId, userId),
    });

    if (existing) {
      await db.update(schema.userConfigs).set(nextPrefs).where(eq(schema.userConfigs.userId, userId));
    } else {
      await db.insert(schema.userConfigs).values({ userId, ...nextPrefs });
    }

    res.json({ config: nextPrefs });
  })
);

app.get(
  "/api/hours",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const email = req.user?.email;
    const userConfig = await resolveUserConfig(email);
    const token = (email ? await getUserTogglToken(email) : null) || TOGGL_API_TOKEN;

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
    res.json({ weeks, config: userConfig });
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

    await upsertUser(user);
    setAuthCookie(res, user);
    res.json({ user });
  })
);

app.get(
  "/api/toggl-token",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const email = req.user?.email;
    if (!email) return res.status(401).json({ error: "Unauthenticated" });

    const userToken = await getUserTogglToken(email);
    const source = userToken ? "store" : TOGGL_API_TOKEN ? "env" : "none";
    res.json({ configured: source !== "none", source });
  })
);

app.post(
  "/api/toggl-token",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { token } = req.body ?? {};
    const email = req.user?.email;
    if (!email) return res.status(401).json({ error: "Unauthenticated" });
    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ error: "token is required" });
    }

    const userId = await getUserId(email);
    if (!userId) return res.status(401).json({ error: "User not found" });

    const existing = await db.query.togglTokens.findFirst({
      where: eq(schema.togglTokens.userId, userId),
    });

    if (existing) {
      await db
        .update(schema.togglTokens)
        .set({ token: token.trim() })
        .where(eq(schema.togglTokens.userId, userId));
    } else {
      await db.insert(schema.togglTokens).values({ userId, token: token.trim() });
    }

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

// Run migrations then start server
migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to run migrations:", err);
    process.exit(1);
  });
