import React from "react";
import { ArrowDown, Check, Minus, Plus, X } from "lucide-react";
import CurrentWeek from "../components/CurrentWeek";
import WeekHistory from "../components/WeekHistory";
import WorkingTimeAccount from "../components/WorkingTimeAccount";
import SettingsMenu from "../components/SettingsMenu";
import { formatMinutes } from "../lib/hours";
import type { AuthUser, ComputedResult, Config, DaysOffMap, PayoutsMap } from "../types";

type Props = {
  summary: ComputedResult;
  config: Config | null;
  user: AuthUser;
  daysOff: DaysOffMap;
  payouts: PayoutsMap;
  rateLimited: boolean;
  activeTab: "current" | "history";
  payoutOpen: boolean;
  pendingPayout: number;
  persistedPayout: number;
  hasChanged: boolean;
  canPayoutMore: boolean;
  savingToken: boolean;
  savingPreferences: boolean;
  onTabChange: (tab: "current" | "history") => void;
  onSwitchToHistory: () => void;
  onToggleDayOff: (weekStart: string, dayIndex: number) => void;
  onLogout: () => void;
  onSaveToken: (token: string) => Promise<boolean>;
  onSavePreferences: (prefs: { targetHoursPerWeek: number; hoursPerDay: number; daysPerWeek: number }) => Promise<boolean | void>;
  onPayoutPlus: () => void;
  onPayoutMinus: () => void;
  onPayoutConfirm: () => void;
  onCancelPayout: () => void;
};

const DashboardPage: React.FC<Props> = ({
  summary,
  config,
  user,
  daysOff,
  rateLimited,
  activeTab,
  payoutOpen,
  pendingPayout,
  persistedPayout,
  hasChanged,
  canPayoutMore,
  savingToken,
  savingPreferences,
  onTabChange,
  onSwitchToHistory,
  onToggleDayOff,
  onLogout,
  onSaveToken,
  onSavePreferences,
  onPayoutPlus,
  onPayoutMinus,
  onPayoutConfirm,
  onCancelPayout,
}) => {
  const pm = payoutOpen ? pendingPayout : persistedPayout;
  const pending = payoutOpen && hasChanged;
  const isCurrent = activeTab === "current";
  const tabClass = (active: boolean) =>
    `text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${active ? "bg-card text-foreground shadow" : "text-subtle hover:text-foreground"}`;
  const cwKey = summary.currentWeek?.weekStart;
  const cwDaysOff = cwKey ? (daysOff[cwKey] ?? []) : [];
  const days = ["Mo", "Di", "Mi", "Do"];

  return (
    <div className="min-h-screen bg-background text-foreground">
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
              onLogout={onLogout}
              user={user}
              config={config}
              savingToken={savingToken}
              onSaveToken={onSaveToken}
              savingPreferences={savingPreferences}
              onSavePreferences={onSavePreferences}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-140px)] max-w-6xl flex-col items-center justify-center gap-8 px-6 pb-16 pt-6">
        <div className="w-full max-w-4xl flex flex-col items-center gap-6">
          <div className="w-full">
            <WorkingTimeAccount minutes={summary.plusAccountMinutes} rateLimited={rateLimited} />
          </div>

          <div className="relative flex flex-wrap w-full items-center gap-2 sm:flex-nowrap">
            <div className="hidden sm:inline-flex gap-1 rounded-full bg-muted/60 p-1">
              <button type="button" className={tabClass(isCurrent)} onClick={() => onTabChange("current")}>
                Aktuelle Woche
              </button>
              <button type="button" className={tabClass(!isCurrent)} onClick={onSwitchToHistory}>
                Historie
              </button>
            </div>

            {!rateLimited && isCurrent && (
              <div
                className={`flex sm:hidden absolute left-1/2 -translate-x-1/2 items-center gap-1.5 flex-wrap transition-all duration-200 ${isCurrent ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                <button
                  type="button"
                  onClick={onCancelPayout}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${pending ? "bg-muted/60 text-rose-400 opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}`}
                >
                  <X size={16} />
                </button>
                <div className="inline-flex items-center gap-0 rounded-full bg-muted/60 p-1">
                  <button
                    type="button"
                    onClick={onPayoutPlus}
                    disabled={!canPayoutMore}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-subtle transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                  </button>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 text-xs tabular-nums ${pm > 0 ? "text-primary" : "text-subtle"} ${pending ? "italic" : ""}`}
                  >
                    <ArrowDown size={12} />
                    {formatMinutes(pm)}
                  </span>
                  <button
                    type="button"
                    onClick={onPayoutMinus}
                    disabled={pm <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-subtle transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Minus size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={pending ? () => void onPayoutConfirm() : undefined}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${pending ? "bg-muted/60 text-emerald-400 opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}`}
                >
                  <Check size={16} />
                </button>
              </div>
            )}

            <div
              className={`ml-auto inline-flex gap-1 rounded-full bg-muted/60 p-1 transition-all duration-200 ${isCurrent ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              {days.map((day, idx) => {
                const off = cwDaysOff.includes(idx);

                return (
                  <button
                    key={day}
                    type="button"
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors ${off ? "text-subtle" : "text-primary"}`}
                    onClick={() => cwKey && onToggleDayOff(cwKey, idx)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full">
            <div className={`${activeTab === "current" ? "" : "hidden"}`}>
              <CurrentWeek week={summary.currentWeek} />
            </div>
            <div
              className={`transition-all duration-300 ${activeTab === "history" ? "opacity-100 max-h-[240px]" : "opacity-0 max-h-0 overflow-hidden"}`}
            >
              <WeekHistory
                weeks={summary.weeks.filter((week) => !week.isCurrentWeek)}
                onToggleDayOff={onToggleDayOff}
                defaultOpen
                disableToggle
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
