import React from "react";
import { ComputedWeek, formatMinutes, formatWeekLabel } from "../utils/hours";

type Props = {
  week?: ComputedWeek;
};

const CurrentWeek: React.FC<Props> = ({ week }) => {
  if (!week) {
    return (
      <div className="card p-4 animate-fade-in">
        <p className="text-sm text-subtle">Aktuelle Woche lädt…</p>
      </div>
    );
  }

  const progress = week.expectedMinutes > 0 ? Math.min(1, week.actualMinutes / week.expectedMinutes) : 0;
  const targetHours = Math.round(week.expectedMinutes / 60);

  return (
    <div className="card p-6 soft-shadow animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm uppercase tracking-wide text-subtle">Aktuelle Woche</p>
          <p className="text-lg font-semibold">{formatWeekLabel(week.weekStart, week.weekEnd)}</p>
        </div>
        <div className="flex items-baseline gap-2 text-subtle">
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            {formatMinutes(week.actualMinutes)}
          </span>
          <span className="text-sm">/ {targetHours}</span>
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
        />
      </div>
    </div>
  );
};

export default CurrentWeek;
