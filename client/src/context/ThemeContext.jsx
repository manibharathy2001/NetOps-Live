import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'netops.theme';

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  return theme;
}

function initialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return apply(saved);
  } catch {
    // storage blocked
  }
  return apply(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // storage blocked: the theme just won't be remembered
    }
  }, [theme]);

  // The attribute is set before the state update so anything reading CSS
  // variables (the topology canvas) sees the new colours immediately.
  const toggle = useCallback(() => {
    setTheme((current) => apply(current === 'dark' ? 'light' : 'dark'));
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
