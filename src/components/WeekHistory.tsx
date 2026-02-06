import React, { useLayoutEffect, useRef, useState } from "react";
import DayOffPicker from "./DayOffPicker";
import { ComputedWeek, formatMinutes, formatWeekLabel } from "../utils/hours";

type Props = {
  weeks: ComputedWeek[];
  onToggleDayOff: (weekStart: string, dayIndex: number) => void;
  header?: React.ReactNode;
  /**
   * When true the list starts expanded instead of showing the CTA button.
   * Useful when the component is used inside a tab where visibility is
   * controlled externally.
   */
  defaultOpen?: boolean;
  /**
   * Locks the component in the expanded state and hides the toggle button.
   */
  disableToggle?: boolean;
};

const WeekHistory: React.FC<Props> = ({
  weeks,
  onToggleDayOff,
  header,
  defaultOpen = false,
  disableToggle = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerMaxHeight, setContainerMaxHeight] = useState<number>(360);

  useLayoutEffect(() => {
    if (disableToggle) {
      setOpen(true);
    }
  }, [disableToggle]);

  useLayoutEffect(() => {
    if (bodyRef.current) {
      setMaxHeight(bodyRef.current.scrollHeight);
    }
  }, [weeks, open]);

  useLayoutEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const heightOfThreeEntries = 390;
      const available = Math.max(240, heightOfThreeEntries);
      setContainerMaxHeight(available);
    };
    update();

    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, [open, weeks.length]);

  const content = (
    <div
      className="card flex w-full max-w-4xl flex-col p-6 soft-shadow animate-fade-in"
      ref={containerRef}
      style={{ maxHeight: open ? undefined : 0 }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-subtle">Wochenhistorie</p>
          <p className="text-lg font-semibold">Alle Wochen seit Startdatum</p>
        </div>
        {!disableToggle && (
          <button
            type="button"
            className="btn btn-muted text-xs px-3 py-1"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? "Einklappen" : "Ausklappen"}
          </button>
        )}
      </div>
      <div
        className="overflow-hidden"
        style={{
          maxHeight: open ? Math.min(maxHeight, containerMaxHeight) : 0,
          opacity: open ? 1 : 0,
          transition: "max-height 260ms ease, opacity 180ms ease",
        }}
      >
        <div
          ref={bodyRef}
          className="scroll-area flex flex-col divide-y divide-border/60"
          style={{ maxHeight: "inherit" }}
        >
          {weeks.map((week) => {
            const diffTone =
              week.diffMinutes > 0 ? "text-emerald-500" : week.diffMinutes < 0 ? "text-rose-500" : "text-subtle";

            return (
              <div key={week.weekStart} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{formatWeekLabel(week.weekStart, week.weekEnd)}</p>
                    <p className="text-xs text-subtle">{week.isCurrentWeek ? "Laufende Woche" : "Abgeschlossen"}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-subtle">Ist {formatMinutes(week.actualMinutes)}</span>
                    <span className="text-subtle">Soll {formatMinutes(week.expectedMinutes)}</span>
                    <span className={`font-semibold ${diffTone}`}>
                      {week.diffMinutes >= 0 ? "+" : ""}
                      {formatMinutes(week.diffMinutes)}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="mb-2 text-xs text-subtle">Urlaub/Feiertage (reduziert Soll um 8h je Tag)</p>
                  <DayOffPicker
                    selected={week.daysOff}
                    onToggle={(dayIndex) => onToggleDayOff(week.weekStart, dayIndex)}
                  />
                </div>
              </div>
            );
          })}
          {weeks.length === 0 && <p className="py-2 text-sm text-subtle">Keine Daten verfügbar.</p>}
        </div>
      </div>
    </div>
  );

  if (!open && !disableToggle) {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        {header}
        <button
          type="button"
          className="btn btn-muted text-sm px-5 py-2"
          onClick={() => setOpen(true)}
          aria-expanded={open}
        >
          Wochenhistorie anzeigen
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {header}
      {content}
    </div>
  );
};

export default WeekHistory;
