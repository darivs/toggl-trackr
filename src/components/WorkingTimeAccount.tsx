import React from "react";
import { Info } from "lucide-react";
import { formatMinutes } from "../utils/hours";

type Props = {
  minutes: number;
};

const WorkingTimeAccount: React.FC<Props> = ({ minutes }) => {
  const positive = minutes >= 0;
  const tone = positive ? "text-emerald-400" : "text-rose-400";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const sign = minutes < 0 ? "-" : "";

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6 animate-fade-in">
      <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-subtle">
        <span>Arbeitszeitkonto</span>
        <span
          className="group relative inline-flex h-5 w-5 items-center justify-center"
          aria-label="Summe abgeschlossener Wochen"
        >
          <Info size={16} className="text-foreground/80" aria-hidden />
          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] font-medium text-background opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            Summe abgeschlossener Wochen
          </span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        {sign && <span className={`text-[6rem] md:text-[6rem] mb-6 font-semibold leading-none ${tone}`}>{sign}</span>}
        <div className="flex items-end gap-0">
          <span
            className={`text-[8rem] md:text-[12rem] lg:text-[14rem] xl:text-[16rem] font-semibold leading-none ${tone}`}
          >
            {hours}
          </span>
          <span className="mb-7 text-[2rem] md:text-[4rem] text-subtle mr-7">h</span>
          <span
            className={`text-[8rem] md:text-[12rem] lg:text-[14rem] xl:text-[16rem] font-semibold leading-none ${tone}`}
          >
            {String(mins).padStart(2, "0")}
          </span>
          <span className="mb-7 text-[2rem] md:text-[4rem] text-subtle">m</span>
        </div>
      </div>
    </div>
  );
};

export default WorkingTimeAccount;
