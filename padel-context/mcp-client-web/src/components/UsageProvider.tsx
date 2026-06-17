"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type TokenUsage = {
  currentMonthTokens: number;
  monthlyTokenLimit: number;
};

type UsageContextValue = {
  usage: TokenUsage | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UsageContext = createContext<UsageContextValue | null>(null);

export function UsageProvider({
  initialUsage,
  children,
}: {
  initialUsage: TokenUsage | null;
  children: ReactNode;
}) {
  const [usage, setUsage] = useState<TokenUsage | null>(initialUsage);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      const payload = await res.json().catch(() => null);

      if (
        !res.ok ||
        typeof payload?.currentMonthTokens !== "number" ||
        typeof payload?.monthlyTokenLimit !== "number"
      ) {
        setError(payload?.error ?? "Quota indisponible.");
        return;
      }

      setUsage({
        currentMonthTokens: payload.currentMonthTokens,
        monthlyTokenLimit: payload.monthlyTokenLimit,
      });
      setError(null);
    } catch {
      setError("Quota indisponible.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <UsageContext.Provider value={{ usage, error, loading, refresh }}>
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage(): UsageContextValue {
  const ctx = useContext(UsageContext);
  if (!ctx) {
    throw new Error(
      "useUsage doit être utilisé à l'intérieur d'un UsageProvider",
    );
  }
  return ctx;
}
