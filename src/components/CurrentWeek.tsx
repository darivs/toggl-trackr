import React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
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
  const hasTargetMinutes = week.expectedMinutes % 60 !== 0;
  const targetLabel = hasTargetMinutes ? formatMinutes(week.expectedMinutes) : String(week.expectedMinutes / 60);
  const hasPayout = week.payoutMinutes > 0;
  const surplusMinutes = Math.max(0, week.actualMinutes - week.expectedMinutes);

  return (
    <div className="card p-6 soft-shadow animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-subtle">Aktuelle Woche</p>
          <p className="text-lg font-semibold">{formatWeekLabel(week.weekStart, week.weekEnd)}</p>
        </div>
        <div className="flex items-center gap-2 text-subtle">
          {hasPayout ? (
            <span className="inline-flex items-center gap-0.5 text-sm text-primary tabular-nums">
              <ArrowDown size={13} />
              {Math.floor(week.payoutMinutes / 60)}h
            </span>
          ) : surplusMinutes > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-sm text-emerald-400 tabular-nums">
              <ArrowUp size={13} />
              {Math.floor(surplusMinutes / 60)}h
            </span>
          ) : null}
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            {formatMinutes(week.actualMinutes)}
          </span>
          <span className={`text-sm transition-colors ${hasPayout ? "text-primary font-semibold" : ""}`}>
            / {targetLabel}
          </span>
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
