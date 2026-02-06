import React from "react";

const DAYS = ["Mo", "Di", "Mi", "Do"];

type Props = {
  selected: number[];
  onToggle: (dayIndex: number) => void;
};

const DayOffPicker: React.FC<Props> = ({ selected, onToggle }) => {
  return (
    <div className="flex gap-2 flex-wrap">
      {DAYS.map((day, idx) => {
        const active = selected.includes(idx);

        return (
          <button
            key={day}
            type="button"
            className={`btn text-xs ${active ? "btn-primary" : "btn-muted"}`}
            onClick={() => onToggle(idx)}
            aria-pressed={active}
            title={active ? `${day}: Frei` : `${day}: Arbeitstag`}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
};

export default DayOffPicker;
