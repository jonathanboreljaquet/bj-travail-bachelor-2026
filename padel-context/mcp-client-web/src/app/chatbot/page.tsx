import { cookies } from "next/headers";
import ChatbotClient from "./ChatbotClient";
import { API_URL } from "@/lib/config";

type TokenUsage = {
  currentMonthTokens: number;
  monthlyTokenLimit: number;
};

async function getInitialTokenUsage(): Promise<{
  usage: TokenUsage | null;
  error: string | null;
}> {
  const cookieStore = await cookies();
  const jwtToken = cookieStore.get("padel_context_jwt_token")?.value;

  if (!jwtToken) {
    return { usage: null, error: "Utilisateur non authentifié." };
  }

  const response = await fetch(`${API_URL}/api/llm-usage/me`, {
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      usage: null,
      error: payload?.message ?? "Quota indisponible.",
    };
  }

  if (
    typeof payload?.currentMonthTokens !== "number" ||
    typeof payload?.monthlyTokenLimit !== "number"
  ) {
    return { usage: null, error: "Quota indisponible." };
  }

  return {
    usage: {
      currentMonthTokens: payload.currentMonthTokens,
      monthlyTokenLimit: payload.monthlyTokenLimit,
    },
    error: null,
  };
}

export default async function Home() {
  const { usage, error } = await getInitialTokenUsage();

  return (
    <ChatbotClient initialTokenUsage={usage} initialTokenUsageError={error} />
  );
}
