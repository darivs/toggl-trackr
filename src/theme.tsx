import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_KEY = "toggl-trackr-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  localStorage.setItem(THEME_KEY, theme);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    const initial = saved ?? "system";
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);

    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (value: Theme) => {
    setThemeState(value);
    applyTheme(value);
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");

  return ctx;
}
