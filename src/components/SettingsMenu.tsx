import React, { useEffect, useRef, useState } from "react";
import { LogOut, Monitor, Moon, Settings, SunMedium } from "lucide-react";
import { useTheme } from "../providers/ThemeProvider";
import type { AuthUser } from "../types";
import type { Config } from "../types";

type ThemeOption = {
  label: string;
  value: "light" | "dark" | "system";
  icon: React.ComponentType<{ className?: string }>;
};

const themeOptions: ThemeOption[] = [
  { label: "Auto", value: "system", icon: Monitor },
  { label: "Light", value: "light", icon: SunMedium },
  { label: "Dark", value: "dark", icon: Moon },
];

type SettingsMenuProps = {
  onLogout: () => void;
  user?: AuthUser | null;
  config?: Config | null;
  onSaveToken: (token: string) => Promise<boolean | void>;
  savingToken?: boolean;
  onSavePreferences: (prefs: {
    targetHoursPerWeek: number;
    hoursPerDay: number;
    daysPerWeek: number;
  }) => Promise<boolean | void>;
  savingPreferences?: boolean;
};

const SettingsMenu: React.FC<SettingsMenuProps> = ({
  onLogout,
  user,
  config,
  onSaveToken,
  savingToken,
  onSavePreferences,
  savingPreferences,
}) => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [tokenValue, setTokenValue] = useState("");
  const [targetHoursPerWeek, setTargetHoursPerWeek] = useState<number | "">("");
  const [hoursPerDay, setHoursPerDay] = useState<number | "">("");
  const [daysPerWeek, setDaysPerWeek] = useState<number | "">("");
  const tokenSourceLabel =
    config?.togglTokenSource === "env"
      ? "aus .env"
      : config?.togglTokenSource === "store"
        ? "gespeichert"
        : "nicht gesetzt";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const handleSelectTheme = (value: ThemeOption["value"]) => {
    setTheme(value);
    setOpen(false);
  };

  const handleLogout = () => {
    setOpen(false);
    onLogout();
  };

  const handleSaveToken = async () => {
    const success = await onSaveToken(tokenValue);
    if (success) {
      setTokenValue("");
      setOpen(false);
    }
  };

  useEffect(() => {
    setTargetHoursPerWeek(config?.targetHoursPerWeek ?? "");
    setHoursPerDay(config?.hoursPerDay ?? "");
    setDaysPerWeek(config?.daysPerWeek ?? "");
  }, [config]);

  const handleSavePrefs = async () => {
    if (targetHoursPerWeek === "" || hoursPerDay === "" || daysPerWeek === "") return;
    const success = await onSavePreferences({
      targetHoursPerWeek,
      hoursPerDay,
      daysPerWeek,
    });
    if (success) {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-muted bg-card text-subtle shadow-sm transition hover:-translate-y-[1px] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <Settings className="h-5 w-5" aria-hidden />
        <span className="sr-only">Einstellungen</span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-muted/70 bg-card/95 p-3 shadow-2xl backdrop-blur">
          {user ? (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-muted/60 bg-muted/30 px-3 py-2 text-sm leading-tight">
              {user.picture ? (
                <img src={user.picture} alt="Avatar" className="h-10 w-10 rounded-full object-cover" />
              ) : null}
              <div className="flex-1">
                <div className="font-semibold">{user.name ?? user.email}</div>
                <div className="text-xs text-subtle">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10 text-destructive transition hover:border-destructive/60 hover:bg-destructive/15"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}

          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">Theme</div>
          <div className="space-y-1">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const active = theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                    active
                      ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
                      : "border-muted/40 text-subtle hover:border-muted hover:bg-muted/50"
                  }`}
                  onClick={() => handleSelectTheme(option.value)}
                  aria-pressed={active}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" aria-hidden />
                    <span>{option.label}</span>
                  </div>
                  {active ? (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Aktiv</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="my-3 h-px bg-muted" />

          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            <span>API Token</span>
            <span className="text-[10px] lowercase text-foreground/60">{tokenSourceLabel}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              className="w-full rounded-xl border border-muted/60 bg-background px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
              placeholder="Toggl API Token"
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
            />
            <button
              type="button"
              onClick={handleSaveToken}
              disabled={savingToken || !tokenValue.trim()}
              className="flex h-10 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingToken ? "…" : "Save"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-subtle">
            Token findest du unter{" "}
            <a className="underline" href="https://track.toggl.com/profile" target="_blank" rel="noreferrer">
              track.toggl.com/profile
            </a>
            .
          </p>

          <div className="my-3 h-px bg-muted" />

          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">Arbeitszeiten</div>
          <div className="space-y-2">
            <label className="flex items-center justify-between rounded-xl border border-muted/60 bg-muted/10 px-3 py-2 text-sm">
              <span>Wochenstunden</span>
              <input
                type="number"
                min={1}
                max={120}
                className="ml-3 w-24 rounded-lg border border-muted/50 bg-background px-2 py-1 text-right text-sm focus:border-primary/60 focus:outline-none"
                value={targetHoursPerWeek}
                onChange={(e) => setTargetHoursPerWeek(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-muted/60 bg-muted/10 px-3 py-2 text-sm">
              <span>Stunden pro Tag</span>
              <input
                type="number"
                min={1}
                max={24}
                className="ml-3 w-24 rounded-lg border border-muted/50 bg-background px-2 py-1 text-right text-sm focus:border-primary/60 focus:outline-none"
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-muted/60 bg-muted/10 px-3 py-2 text-sm">
              <span>Arbeitstage/Woche</span>
              <input
                type="number"
                min={1}
                max={7}
                className="ml-3 w-24 rounded-lg border border-muted/50 bg-background px-2 py-1 text-right text-sm focus:border-primary/60 focus:outline-none"
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={handleSavePrefs}
              disabled={
                savingPreferences ||
                targetHoursPerWeek === "" ||
                hoursPerDay === "" ||
                daysPerWeek === ""
              }
              className="flex h-10 w-full items-center justify-center rounded-xl bg-foreground px-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingPreferences ? "Speichere…" : "Arbeitszeiten speichern"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SettingsMenu;
