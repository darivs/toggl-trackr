import React, { useEffect, useMemo, useState } from "react";
import { getConfig, getDaysOff, getHours, setDaysOff } from "./api";
import CurrentWeek from "./components/CurrentWeek";
import WorkingTimeAccount from "./components/WorkingTimeAccount";
import ThemeToggle from "./components/ThemeToggle";
import WeekHistory from "./components/WeekHistory";
import type { Config, DaysOffMap, WeekSummary } from "./utils/hours";
import { computeSummary } from "./utils/hours";
import Tabs from "./components/Tabs";

const App: React.FC = () => {
  const [config, setConfig] = useState<Config | null>(null);
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [daysOff, setDaysOffState] = useState<DaysOffMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [cfg, hours, offs] = await Promise.all([
          getConfig().catch(() => null),
          getHours().catch(() => []),
          getDaysOff().catch(() => ({})),
        ]);
        if (!cfg) {
          setError("Konnte Config nicht laden (prüfe Backend/ENV).");
        } else {
          setConfig(cfg);
        }
        setWeeks(hours);
        setDaysOffState(offs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    };

    load();
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-subtle">made with ♥</p>
            <h1 className="text-2xl font-semibold">toggl-trackr</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-140px)] max-w-6xl flex-col items-center justify-center gap-8 px-6 pb-16 pt-6">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {summary ? (
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
