import React, { useEffect, useMemo, useState } from "react";
import { getConfig, getCurrentUser, getDaysOff, getHours, logout, setDaysOff } from "./api";
import CurrentWeek from "./components/CurrentWeek";
import WorkingTimeAccount from "./components/WorkingTimeAccount";
import ThemeToggle from "./components/ThemeToggle";
import WeekHistory from "./components/WeekHistory";
import type { Config, DaysOffMap, WeekSummary } from "./utils/hours";
import { computeSummary } from "./utils/hours";
import Tabs from "./components/Tabs";
import { GoogleLogin, type AuthUser } from "./auth";

const App: React.FC = () => {
  const [config, setConfig] = useState<Config | null>(null);
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [daysOff, setDaysOffState] = useState<DaysOffMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const loadProtected = async () => {
    try {
      const [hours, offs] = await Promise.all([getHours().catch(() => []), getDaysOff().catch(() => ({}))]);
      setWeeks(hours);
      setDaysOffState(offs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte Daten nicht laden");
    }
  };

  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoading(true);
        const [cfg, me] = await Promise.all([getConfig().catch(() => null), getCurrentUser().catch(() => null)]);
        if (!cfg) {
          setError("Konnte Config nicht laden (prüfe Backend/ENV).");
        } else {
          setConfig(cfg);
        }
        if (me?.user) {
          setUser(me.user);
          await loadProtected();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    };

    void loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    if (!config) return null;

    return computeSummary({ weeks, daysOff, config });
  }, [config, weeks, daysOff]);

  const handleToggleDayOff = async (weekStart: string, dayIndex: number) => {
    setError(null);
    const current = daysOff[weekStart] ?? [];
    const next = current.includes(dayIndex) ? current.filter((d) => d !== dayIndex) : [...current, dayIndex].sort();
    setDaysOffState({ ...daysOff, [weekStart]: next });

    try {
      const updated = await setDaysOff(weekStart, next);
      setDaysOffState(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte Tage nicht speichern");
    }
  };

  const handleLogin = async (u: AuthUser) => {
    setUser(u);
    setError(null);
    await loadProtected();
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout fehlgeschlagen");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-subtle">made with ♥</p>
            <h1 className="text-2xl font-semibold">toggl-trackr</h1>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm">
                  {user.picture ? <img src={user.picture} className="h-7 w-7 rounded-full" alt="Avatar" /> : null}
                  <div className="leading-tight">
                    <div className="font-medium">{user.name ?? user.email}</div>
                    <div className="text-xs text-subtle">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-muted px-3 py-1 text-sm text-subtle hover:border-foreground hover:text-foreground"
                >
                  Logout
                </button>
              </>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-140px)] max-w-6xl flex-col items-center justify-center gap-8 px-6 pb-16 pt-6">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!user ? (
          <div className="w-full max-w-md rounded-2xl border border-muted/60 bg-muted/20 p-6 text-center shadow-sm">
            <h2 className="mb-2 text-xl font-semibold">Anmelden</h2>
            <p className="mb-4 text-subtle">Bitte mit Google anmelden, um deine Toggl-Zeiten zu laden.</p>
            <GoogleLogin
              onLogin={handleLogin}
              onError={(msg) => setError(msg)}
            />
          </div>
        ) : summary ? (
          <div className="w-full max-w-4xl flex flex-col items-center gap-6">
            <div className="w-full">
              <WorkingTimeAccount minutes={summary.plusAccountMinutes} />
            </div>
            <Tabs
              tabs={[
                { id: "current", label: "Aktuelle Woche" },
                { id: "history", label: "Historie" },
              ]}
              initialId="current"
            >
              {(active) => (
                <>
                  {active === "current" && (
                    <div className="w-full">
                      <CurrentWeek week={summary.currentWeek} />
                    </div>
                  )}
                  {active === "history" && (
                    <WeekHistory
                      weeks={summary.weeks.filter((week) => !week.isCurrentWeek)}
                      onToggleDayOff={handleToggleDayOff}
                      defaultOpen
                      disableToggle
                    />
                  )}
                </>
              )}
            </Tabs>
          </div>
        ) : (
          <div className="text-subtle">{loading ? "Lade Daten…" : "Keine Daten verfügbar."}</div>
        )}
      </main>
    </div>
  );
};

export default App;
