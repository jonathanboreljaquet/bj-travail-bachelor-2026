import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL } from "@/lib/config";
import { UsageProvider, type TokenUsage } from "@/components/UsageProvider";
import TabNav from "@/components/TabNav";
import TokenBadge from "@/components/TokenBadge";
import LogoutButton from "@/components/LogoutButton";

async function getInitialUsage(jwt: string): Promise<TokenUsage | null> {
  try {
    const res = await fetch(`${API_URL}/api/llm-usage/me`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });
    const payload = await res.json().catch(() => null);

    if (
      !res.ok ||
      typeof payload?.currentMonthTokens !== "number" ||
      typeof payload?.monthlyTokenLimit !== "number"
    ) {
      return null;
    }

    return {
      currentMonthTokens: payload.currentMonthTokens,
      monthlyTokenLimit: payload.monthlyTokenLimit,
    };
  } catch {
    return null;
  }
}

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Garde d'authentification commune aux deux onglets.
  const jwt = (await cookies()).get("padel_context_jwt_token")?.value;
  if (!jwt) redirect("/login");

  const initialUsage = await getInitialUsage(jwt);

  return (
    <UsageProvider initialUsage={initialUsage}>
      <div className="flex h-screen flex-col bg-gradient-to-b from-emerald-50/60 via-gray-50 to-gray-50">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-4 py-5 sm:px-6">
          <header className="mb-4 flex flex-shrink-0 flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-lg shadow-sm">
                🎾
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">
                  Padel Context
                </h1>
                <p className="text-xs text-black/50">
                  Réserve et organise tes matchs
                </p>
              </div>
            </div>

            <TabNav />

            <div className="flex items-center gap-4">
              <TokenBadge />
              <LogoutButton />
            </div>
          </header>

          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </div>
    </UsageProvider>
  );
}
