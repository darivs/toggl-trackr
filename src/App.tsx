import React, { useEffect, useMemo, useState } from "react";
import { getConfig, getCurrentUser, getDaysOff, getHours, logout, saveTogglToken, saveUserConfig, setDaysOff } from "./api";
import CurrentWeek from "./components/CurrentWeek";
import WorkingTimeAccount from "./components/WorkingTimeAccount";
import SettingsMenu from "./components/SettingsMenu";
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
  const [tokenInput, setTokenInput] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const loadProtected = async (opts?: { force?: boolean }) => {
    if (!opts?.force && config && !config.testMode && config.needsTogglToken) return;
    try {
      setLoadingData(true);
      const [hours, offs] = await Promise.all([getHours().catch(() => []), getDaysOff().catch(() => ({}))]);
      setWeeks(hours);
      setDaysOffState(offs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte Daten nicht laden");
    } finally {
      setLoadingData(false);
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
    try {
      const refreshed = await getConfig();
      setConfig(refreshed);
      if (!refreshed.testMode && refreshed.needsTogglToken) return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte Config nach Login nicht laden");

      return;
    }
    await loadProtected({ force: true });
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setWeeks([]);
      setDaysOffState({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout fehlgeschlagen");
    }
  };

  const handleSaveToken = async (token: string) => {
    if (!token.trim()) {
      setError("Bitte einen gültigen Toggl API Token eingeben.");

      return false;
    }
    setSavingToken(true);
    setError(null);
    try {
      await saveTogglToken(token.trim());
      if (token === tokenInput) {
        setTokenInput("");
      }
      setConfig((prev) =>
        prev ? { ...prev, needsTogglToken: false, togglTokenConfigured: true, togglTokenSource: "store" } : prev
      );

      await loadProtected({ force: true });

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Token konnte nicht gespeichert werden";
      setError(msg);

      return false;
    } finally {
      setSavingToken(false);
    }
  };

  const handleSavePreferences = async (prefs: {
    targetHoursPerWeek: number;
    hoursPerDay: number;
    daysPerWeek: number;
  }) => {
    setSavingPreferences(true);
    setError(null);
    try {
      const saved = await saveUserConfig(prefs);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              targetHoursPerWeek: saved.targetHoursPerWeek,
              hoursPerDay: saved.hoursPerDay,
              daysPerWeek: saved.daysPerWeek,
            }
          : prev
      );
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Einstellungen konnten nicht gespeichert werden";
      setError(msg);
      return false;
    } finally {
      setSavingPreferences(false);
    }
  };

  const tokenRequired = config && !config.testMode && config.needsTogglToken;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {user ? (
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-subtle">made with ♥</p>
              <h1 className="text-2xl font-semibold">toggl-trackr</h1>
            </div>
            <div className="flex items-center gap-3">
              <SettingsMenu
                onLogout={handleLogout}
                user={user}
                config={config}
                savingToken={savingToken}
                onSaveToken={handleSaveToken}
                savingPreferences={savingPreferences}
                onSavePreferences={handleSavePreferences}
              />
            </div>
          </div>
        </header>
      ) : null}

      <main className="mx-auto flex min-h-[calc(100vh-140px)] max-w-6xl flex-col items-center justify-center gap-8 px-6 pb-16 pt-6">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 text-subtle">
            <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Lade…</span>
          </div>
        ) : !user ? (
          <div className="w-full max-w-lg rounded-2xl border border-muted/60 bg-muted/20 p-6 text-center shadow-sm">
            <h2 className="mb-2 text-xl font-semibold">Anmelden</h2>
            <p className="mb-4 text-subtle">Mit Google anmelden, um deine Toggl-Zeiten zu laden.</p>
            <GoogleLogin onLogin={handleLogin} onError={(msg) => setError(msg)} googleClientId={config?.googleClientId} />
          </div>
        ) : tokenRequired ? (
          <div className="w-full max-w-lg rounded-2xl border border-muted/60 bg-muted/20 p-6 shadow-sm">
            <h2 className="mb-2 text-xl font-semibold">Toggl API Token hinterlegen</h2>
            <p className="mb-4 text-subtle">
              Dein Google-Login ist erledigt. Bitte füge jetzt deinen persönlichen Toggl API Token hinzu, damit die
              Zeiten geladen werden können. Du findest ihn unter{" "}
              <a className="underline" href="https://track.toggl.com/profile" target="_blank" rel="noreferrer">
                track.toggl.com/profile
              </a>
              .
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="password"
                className="w-full rounded-xl border border-muted bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
                placeholder="Toggl API Token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <button
                onClick={() => void handleSaveToken(tokenInput)}
                disabled={savingToken || !tokenInput.trim()}
                className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingToken ? "Speichere…" : "Token speichern"}
              </button>
            </div>
          </div>
        ) : loadingData ? (
          <div className="flex flex-col items-center gap-3 text-subtle">
            <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Lade Daten…</span>
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
          <div className="text-subtle">Keine Daten verfügbar.</div>
        )}
      </main>
    </div>
  );
};

export default App;
