"use client";

import { useUsage } from "./UsageProvider";

export default function TokenBadge() {
  const { usage, error, loading } = useUsage();

  if (error) {
    return <span className="text-xs text-red-600">{error}</span>;
  }

  if (!usage) {
    return (
      <span className="text-xs text-black/50">
        {loading ? "Chargement du quota…" : null}
      </span>
    );
  }

  const ratio =
    usage.monthlyTokenLimit > 0
      ? Math.min(usage.currentMonthTokens / usage.monthlyTokenLimit, 1)
      : 0;
  const nearLimit = ratio >= 0.9;

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-xs font-medium text-black/60">
        Tokens {usage.currentMonthTokens.toLocaleString("fr-CH")} /{" "}
        {usage.monthlyTokenLimit.toLocaleString("fr-CH")}
      </span>
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-200">
        <div
          className={`h-full rounded-full transition-all ${
            nearLimit ? "bg-red-500" : "bg-emerald-500"
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
