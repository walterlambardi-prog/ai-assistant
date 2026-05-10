"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "./en.json";
import es from "./es.json";
import { api } from "@/lib/api";

export type Locale = "en" | "es";

const dictionaries: Record<Locale, typeof en> = { en, es };

type I18nCtx = {
  locale: Locale;
  setLocale: (l: Locale) => Promise<void> | void;
  t: (path: string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

const STORAGE_KEY = "app.locale";

function readNested(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  );
}

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Load from localStorage first, then sync with backend config (server is source of truth)
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? (localStorage.getItem(STORAGE_KEY) as Locale | null)
        : null;
    if (saved === "en" || saved === "es") setLocaleState(saved);
    api
      .getConfig()
      .then((cfg) => {
        const l = cfg.language === "es" ? "es" : "en";
        setLocaleState(l);
        if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
      })
      .catch(() => undefined);
  }, []);

  const setLocale = useCallback(async (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
    try {
      await api.updateConfig({ language: l });
    } catch {
      /* ignore: optimistic UI */
    }
  }, []);

  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => {
      const dict = dictionaries[locale];
      const fallback = dictionaries.en;
      const raw = readNested(dict, path) ?? readNested(fallback, path) ?? path;
      return format(raw, vars);
    },
    [locale]
  );

  const value = useMemo<I18nCtx>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
