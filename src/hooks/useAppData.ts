import { useEffect, useMemo, useState } from "react";
import {
  ApiRequestError,
  getConfig,
  getCurrentUser,
  getDaysOff,
  getHours,
  getPayouts,
  logout,
  savePayout,
  saveTogglToken,
  saveUserConfig,
  setDaysOff,
} from "../api/client";
import { computeSummary } from "../lib/hours";
import type { AuthUser, Config, DaysOffMap, PayoutsMap, WeekSummary } from "../types";

export function useAppData() {
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
      const [hours, offs, p] = await Promise.all([
        getHours(),
        getDaysOff().catch(() => ({})),
        getPayouts().catch(() => ({})),
      ]);
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

    const mergedPayouts = payoutOpen
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");

          return { ...payouts, [`${y}-${m}-${day}`]: pendingPayout };
        })()
      : payouts;

    return computeSummary({ weeks, daysOff, payouts: mergedPayouts, config });
  }, [config, weeks, daysOff, payouts, pendingPayout, payoutOpen]);

  const currentWeek = summary?.currentWeek;
  const currentWeekKey = currentWeek?.weekStart;
  const persistedPayout = currentWeekKey ? (payouts[currentWeekKey] ?? 0) : 0;
  const accountMinutes = summary?.plusAccountMinutes ?? 0;
  const currentPayout = payoutOpen ? pendingPayout : persistedPayout;
  const remainingTarget = currentWeek
    ? Math.max(0, currentWeek.expectedMinutes + currentPayout - currentWeek.actualMinutes)
    : 0;
  const maxPayout = Math.min(accountMinutes + currentPayout, remainingTarget);
  const hasChanged = pendingPayout !== persistedPayout;
  const canPayoutMore = pendingPayout < maxPayout;

  const handleToggleDayOff = async (weekStart: string, dayIndex: number) => {
    setError(null);
    if (payoutOpen && summary?.currentWeek && weekStart === summary.currentWeek.weekStart) {
      setPendingPayout(persistedPayout);
      setPayoutOpen(false);
    }
    const current = daysOff[weekStart] ?? [];
    const next = current.includes(dayIndex) ? current.filter((d) => d !== dayIndex) : [...current, dayIndex].sort();
    setDaysOffState({ ...daysOff, [weekStart]: next });

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
          } catch {
            /* payout adjust failed, non-critical */
          }
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

  const handleSwitchToHistory = () => {
    setActiveTab("history");
    if (payoutOpen) {
      setPendingPayout(persistedPayout);
      setPayoutOpen(false);
    }
  };

  const handleCancelPayout = () => {
    setPendingPayout(persistedPayout);
    setPayoutOpen(false);
  };

  return {
    // State
    config,
    weeks,
    daysOff,
    loading,
    error,
    user,
    tokenInput,
    setTokenInput,
    savingToken,
    savingPreferences,
    loadingData,
    rateLimited,
    payouts,
    pendingPayout,
    payoutOpen,
    activeTab,
    setActiveTab,
    // Computed
    summary,
    currentWeek,
    currentWeekKey,
    persistedPayout,
    accountMinutes,
    currentPayout,
    maxPayout,
    hasChanged,
    canPayoutMore,
    // Handlers
    handleToggleDayOff,
    handleLogin,
    handleLogout,
    handleSaveToken,
    handleSavePreferences,
    handlePayoutPlus,
    handlePayoutMinus,
    handlePayoutConfirm,
    handleSwitchToHistory,
    handleCancelPayout,
  };
}
