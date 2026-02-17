import React, { useEffect, useMemo, useState } from "react";
import { ApiRequestError, getConfig, getCurrentUser, getDaysOff, getHours, getPayouts, logout, savePayout, saveTogglToken, saveUserConfig, setDaysOff } from "./api";
import type { PayoutsMap } from "./api";
import CurrentWeek from "./components/CurrentWeek";
import WorkingTimeAccount from "./components/WorkingTimeAccount";
import SettingsMenu from "./components/SettingsMenu";
import WeekHistory from "./components/WeekHistory";
import type { Config, DaysOffMap, WeekSummary } from "./utils/hours";
import { computeSummary, formatMinutes } from "./utils/hours";
import { GoogleLogin, type AuthUser } from "./auth";
import { ArrowDown, Check, Minus, Plus, X } from "lucide-react";

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
  const [loadingData, setLoadingData] = useState(true);
  const [rateLimited, setRateLimited] = useState(false);
  const [payouts, setPayouts] = useState<PayoutsMap>({});
  const [pendingPayout, setPendingPayout] = useState(0);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");

  const loadProtected = async (opts?: { force?: boolean }) => {
    if (!opts?.force && config && !config.testMode && config.needsTogglToken) return;
    try {
      setLoadingData(true);
      setRateLimited(false);
      const [hours, offs, p] = await Promise.all([getHours(), getDaysOff().catch(() => ({})), getPayouts().catch(() => ({}))]);
      setWeeks(hours);
      setDaysOffState(offs);
      setPayouts(p);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 429) {
        setRateLimited(true);
      } else {
        setError(err instanceof Error ? err.message : "Konnte Daten nicht laden");
      }
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
          await loadProtected({ force: true });
        } else {
          setLoadingData(false);
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

    // When editing, use the edited total for the current week
    const mergedPayouts = payoutOpen ? (() => {
      const d = new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return { ...payouts, [`${y}-${m}-${day}`]: pendingPayout };
    })() : payouts;

    return computeSummary({ weeks, daysOff, payouts: mergedPayouts, config });
  }, [config, weeks, daysOff, payouts, pendingPayout, payoutOpen]);

  const handleToggleDayOff = async (weekStart: string, dayIndex: number) => {
    setError(null);
    if (payoutOpen && summary?.currentWeek && weekStart === summary.currentWeek.weekStart) {
      setPendingPayout(persistedPayout);
      setPayoutOpen(false);
    }
    const current = daysOff[weekStart] ?? [];
    const next = current.includes(dayIndex) ? current.filter((d) => d !== dayIndex) : [...current, dayIndex].sort();
    setDaysOffState({ ...daysOff, [weekStart]: next });

    // Auto-reduce payout if day off would push effective target below actual hours
    if (config && summary?.currentWeek && weekStart === summary.currentWeek.weekStart) {
      const newBaseTarget = Math.max(0, (config.targetHoursPerWeek - next.length * config.hoursPerDay) * 60);
      const currentPayout = payouts[weekStart] ?? 0;
      const actual = summary.currentWeek.actualMinutes;
      if (currentPayout > 0 && newBaseTarget - currentPayout < actual) {
        const cappedPayout = Math.max(0, newBaseTarget - actual);
        if (cappedPayout !== currentPayout) {
          try {
            const updatedPayouts = await savePayout(weekStart, cappedPayout);
            setPayouts(updatedPayouts);
            if (payoutOpen) setPendingPayout(cappedPayout);
          } catch { /* payout adjust failed, non-critical */ }
        }
      }
    }

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

  const accountMinutes = summary?.plusAccountMinutes ?? 0;
  const currentWeek = summary?.currentWeek;
  const currentWeekKey = currentWeek?.weekStart;
  const persistedPayout = currentWeekKey ? (payouts[currentWeekKey] ?? 0) : 0;
  const currentPayout = payoutOpen ? pendingPayout : persistedPayout;
  const remainingTarget = currentWeek ? Math.max(0, currentWeek.expectedMinutes + currentPayout - currentWeek.actualMinutes) : 0;
  const maxPayout = Math.min(accountMinutes + currentPayout, remainingTarget);
  const hasChanged = pendingPayout !== persistedPayout;
  const canPayoutMore = pendingPayout < maxPayout;

  const ensurePayoutOpen = () => {
    if (!payoutOpen) {
      setPendingPayout(persistedPayout);
      setPayoutOpen(true);
      return persistedPayout;
    }
    return pendingPayout;
  };

  const handlePayoutPlus = () => {
    const base = ensurePayoutOpen();
    const available = maxPayout - base;
    const remainder = base % 60;
    const toNextHour = remainder > 0 ? 60 - remainder : 60;
    const step = Math.min(toNextHour, available);
    if (step > 0) setPendingPayout(base + step);
  };

  const handlePayoutMinus = () => {
    const base = ensurePayoutOpen();
    const remainder = base % 60;
    const step = remainder > 0 ? remainder : Math.min(60, base);
    if (step > 0) setPendingPayout(base - step);
  };

  const handlePayoutConfirm = async () => {
    if (!currentWeekKey || !hasChanged) return;
    try {
      const updated = await savePayout(currentWeekKey, pendingPayout);
      setPayouts(updated);
      if (pendingPayout === 0) setPayoutOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auszahlung konnte nicht gespeichert werden");
    }
  };

  const showPayoutButton = !payoutOpen && (canPayoutMore || persistedPayout > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {user ? (
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <div
              className="group relative cursor-pointer select-none hover:animate-wiggle"
              onClick={() => window.open("https://github.com/darivs/toggl-trackr", "_blank")}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-subtle">made with ♥</p>
              <h1 className="text-2xl font-semibold">toggl-trackr</h1>
              <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] font-medium text-background opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                GitHub Repo
              </span>
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
              <WorkingTimeAccount
                minutes={summary.plusAccountMinutes}
                rateLimited={rateLimited}
              />
            </div>
            {(() => {
              const pm = payoutOpen ? pendingPayout : persistedPayout;
              const pending = payoutOpen && hasChanged;
              const isCurrent = activeTab === "current";
              const iconBtn = "flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-subtle transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed";
              const tabClass = (active: boolean) =>
                `text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${active ? "bg-card text-foreground shadow" : "text-subtle hover:text-foreground"}`;
              const cwKey = summary.currentWeek?.weekStart;
              const cwDaysOff = cwKey ? (daysOff[cwKey] ?? []) : [];
              const days = ["Mo", "Di", "Mi", "Do"];
              return (
                <div className="relative flex w-full items-center">
                  <div className="inline-flex gap-1 rounded-full bg-muted/60 p-1">
                    <button type="button" className={tabClass(isCurrent)} onClick={() => setActiveTab("current")}>
                      Aktuelle Woche
                    </button>
                    <button type="button" className={tabClass(!isCurrent)} onClick={() => { setActiveTab("history"); if (payoutOpen) { setPendingPayout(persistedPayout); setPayoutOpen(false); } }}>
                      Historie
                    </button>
                  </div>
                  {!rateLimited && (
                    <div className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 transition-all duration-200 ${isCurrent ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                      <button
                        type="button"
                        onClick={() => { setPendingPayout(persistedPayout); setPayoutOpen(false); }}
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${pending ? "bg-muted/60 text-rose-400 opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}`}
                      >
                        <X size={16} />
                      </button>
                      <div className="inline-flex items-center gap-0 rounded-full bg-muted/60 p-1">
                        <button type="button" onClick={handlePayoutPlus} disabled={!canPayoutMore} className="flex h-7 w-7 items-center justify-center rounded-full text-subtle transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed">
                          <Plus size={14} />
                        </button>
                        <span className={`inline-flex items-center gap-1 px-1.5 text-xs tabular-nums ${pm > 0 ? "text-primary" : "text-subtle"} ${pending ? "italic" : ""}`}>
                          <ArrowDown size={12} />
                          {formatMinutes(pm)}
                        </span>
                        <button type="button" onClick={handlePayoutMinus} disabled={pm <= 0} className="flex h-7 w-7 items-center justify-center rounded-full text-subtle transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed">
                          <Minus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={pending ? () => void handlePayoutConfirm() : undefined}
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${pending ? "bg-muted/60 text-emerald-400 opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}`}
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  )}
                  <div className={`ml-auto inline-flex gap-1 rounded-full bg-muted/60 p-1 transition-all duration-200 ${isCurrent ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                    {days.map((day, idx) => {
                      const off = cwDaysOff.includes(idx);
                      return (
                        <button
                          key={day}
                          type="button"
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors ${off ? "text-subtle" : "text-primary"}`}
                          onClick={() => cwKey && handleToggleDayOff(cwKey, idx)}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {activeTab === "current" && (
              <div className="w-full">
                <CurrentWeek week={summary.currentWeek} />
              </div>
            )}
            {activeTab === "history" && (
              <WeekHistory
                weeks={summary.weeks.filter((week) => !week.isCurrentWeek)}
                onToggleDayOff={handleToggleDayOff}
                defaultOpen
                disableToggle
              />
            )}
          </div>
        ) : (
          <div className="text-subtle">Keine Daten verfügbar.</div>
        )}
      </main>
    </div>
  );
};

export default App;
