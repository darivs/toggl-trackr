import React from "react";
import { useTheme } from "../theme";

const options: { label: string; value: "light" | "dark" | "system" }[] = [
  { label: "Auto", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2 rounded-full border px-2 py-1 bg-card shadow-sm">
      {options.map((option) => {
        const active = theme === option.value;

        return (
          <button
            key={option.value}
            className={`btn text-xs ${active ? "btn-primary shadow-sm" : "btn-muted"}`}
            onClick={() => setTheme(option.value)}
            type="button"
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
