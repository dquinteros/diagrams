import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type Theme, darkTheme, lightTheme } from "../lib/themes";

interface ThemeContextValue {
  theme: Theme;
  themeId: "dark" | "light";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  themeId: "dark",
  toggleTheme: () => {},
});

function getInitialTheme(): "dark" | "light" {
  try {
    const stored = localStorage.getItem("diagrams-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage may be unavailable
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<"dark" | "light">(getInitialTheme);

  const toggleTheme = useCallback(() => {
    setThemeId((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("diagrams-theme", next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const theme = themeId === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, themeId, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
