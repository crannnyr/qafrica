import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'light';
    }
    return 'light';
  });

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = () => {
      const systemDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const isDarkMode = theme === 'dark' || (theme === 'system' && systemDark);

      setIsDark(isDarkMode);

      if (isDarkMode) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    // Only listen for system changes when user explicitly selected 'system'
    let mediaQuery: MediaQueryList | null = null;

    const handler = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    if (theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', handler);
    }

    return () => {
      if (mediaQuery) {
        mediaQuery.removeEventListener('change', handler);
      }
    };
  }, [theme]);

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('theme', newTheme);
    } catch (e) {
      // ignore localStorage errors (private mode, etc.)
    }
  };

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setThemeValue(newTheme);
  };

  return {
    theme,
    isDark,
    setTheme: setThemeValue,
    toggleTheme,
  };
}

export default useDarkMode;
