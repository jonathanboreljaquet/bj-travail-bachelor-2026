import { cookies } from "next/headers";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMCPClient } from "@ai-sdk/mcp";
import {
  convertToModelMessages,
  isTextUIPart,
  stepCountIs,
  streamText,
  type ToolSet,
  type UIMessage,
} from "ai";
import { getChatRatelimit } from "@/lib/ratelimit";
import { getRateLimitIdentifier } from "@/lib/request-identifier";
import { API_URL, MCP_SERVER_URL } from "@/lib/config";

export const runtime = "nodejs";

const modelId = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

export function getLatestUserPrompt(messages: UIMessage[]): string {
  const message = messages.at(-1);

  if (!message || message.role !== "user") {
    return "[Action système]";
  }

  const text = message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("\n")
    .trim();

  return text || "[Validation d'une action de l'outil par l'utilisateur]";
}

const CONTEXT_WINDOW_SIZE = 6;

function getSafeSlidingWindow(
  messages: UIMessage[],
  maxMessages: number,
): UIMessage[] {
  if (messages.length <= maxMessages) return messages;

  let startIndex = messages.length - maxMessages;
  while (startIndex > 0 && messages[startIndex].role !== "user") {
    startIndex--;
  }

  return messages.slice(startIndex);
}

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

const google = createGoogleGenerativeAI({ apiKey });

export async function POST(request: Request) {
  if (!apiKey) {
    return Response.json({ error: "Missing model API key." }, { status: 500 });
  }

  const cookieStore = await cookies();
  const jwtToken = cookieStore.get("padel_context_jwt_token")?.value;

  if (!jwtToken) {
    return Response.json(
      { error: "Utilisateur non authentifié." },
      { status: 401 },
    );
  }

  const identifier = getRateLimitIdentifier(request, jwtToken);
  const rateLimitResult = await getChatRatelimit().limit(identifier);

  if (!rateLimitResult.success) {
    return Response.json(
      {
        error:
          "Vous avez le droit à 5 questions par minute, veuillez patienter.",
      },
      { status: 429 },
    );
  }

  const { messages }: { messages: UIMessage[] } = await request.json();
  const prompt = getLatestUserPrompt(messages) ?? "Prompt non disponible.";

  const usageResponse = await fetch(`${API_URL}/api/llm-usage/me`, {
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  });

  const usagePayload = (await usageResponse.json().catch(() => null)) as {
    currentMonthTokens?: number;
    monthlyTokenLimit?: number;
    message?: string;
  } | null;

  if (!usageResponse.ok) {
    return Response.json(
      { error: usagePayload?.message ?? "Impossible de vérifier le quota." },
      { status: usageResponse.status },
    );
  }

  const currentMonthTokens = usagePayload?.currentMonthTokens;
  const monthlyTokenLimit = usagePayload?.monthlyTokenLimit;

  if (
    typeof currentMonthTokens !== "number" ||
    typeof monthlyTokenLimit !== "number"
  ) {
    return Response.json(
      { error: "Impossible de lire le quota utilisateur." },
      { status: 500 },
    );
  }

  if (currentMonthTokens >= monthlyTokenLimit) {
    return Response.json({ error: "Quota mensuel atteint" }, { status: 403 });
  }

  const mcpClient = await createMCPClient({
    transport: {
      type: "http",
      url: MCP_SERVER_URL,
      headers: jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    },
  });

  // Fermeture idempotente : la connexion MCP doit être fermée quel que soit le
  // chemin de sortie (succès, erreur de stream, abandon client, erreur de setup).
  let mcpClientClosed = false;
  const closeMcpClient = async () => {
    if (mcpClientClosed) return;
    mcpClientClosed = true;
    try {
      await mcpClient.close();
    } catch (closeError) {
      console.error("Erreur lors de la fermeture du client MCP:", closeError);
    }
  };

  try {
    const tools = await mcpClient.tools();

    // Liste des outils sensibles
    const unsafeTools = ["create-match-from-slot", "join-open-match"];

    for (const toolName of unsafeTools) {
      if (tools[toolName]) {
        tools[toolName].needsApproval = true;
      }
    }

    const now = new Date();
    const currentDate = now.toLocaleDateString("fr-CH", {
      timeZone: "Europe/Zurich",
    });
    const currentTime = now.toLocaleTimeString("fr-CH", {
      timeZone: "Europe/Zurich",
    });
    const dayOfWeek = now.toLocaleDateString("fr-CH", {
      weekday: "long",
      timeZone: "Europe/Zurich",
    });

    const systemPrompt = `
    Tu es l'assistant IA officiel de l'application Padel Context.
    Ton rôle est d'accompagner les utilisateurs à travers deux parcours principaux :
    1. Créer un match : Trouver un terrain libre (créneau) pour y organiser une nouvelle partie.
    2. Rejoindre un match : Trouver une partie ouverte existante et s'y inscrire.
    
    INFORMATIONS DE CONTEXTE TEMPOREL :
    - Date actuelle : ${dayOfWeek} ${currentDate}
    - Heure locale : ${currentTime} (Heure de Genève, CET/CEST)
    - Utilise STRICTEMENT cette date comme point de référence absolu lorsque l'utilisateur mentionne des termes relatifs comme "aujourd'hui", "demain", "ce soir" ou "ce week-end".
    `.trim();

    const result = streamText({
      model: google(modelId),
      system: systemPrompt,
      messages: await convertToModelMessages(
        getSafeSlidingWindow(messages, CONTEXT_WINDOW_SIZE),
      ),
      tools: tools as ToolSet,
      stopWhen: stepCountIs(5),
      experimental_telemetry: {
        isEnabled: true,
        functionId: "padel-context-mcp",
      },
      onFinish: async ({ usage }) => {
        try {
          if (
            !usage ||
            typeof usage.inputTokens !== "number" ||
            typeof usage.outputTokens !== "number"
          ) {
            console.error("Usage LLM indisponible après streaming");
            return;
          }

          const inputTokens = usage.inputTokens;
          const outputTokens = usage.outputTokens;
          const totalTokens = inputTokens + outputTokens;

          const response = await fetch(`${API_URL}/api/llm-usage/log`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${jwtToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt,
              inputTokens,
              outputTokens,
              totalTokens,
              model: modelId,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              "Erreur lors de la journalisation LLM:",
              response.status,
              errorText,
            );
          }
        } catch (error) {
          console.error("Erreur inattendue lors du logging LLM:", error);
        } finally {
          await closeMcpClient();
        }
      },
      onError: async ({ error }) => {
        console.error("Erreur lors du streaming LLM:", error);
        await closeMcpClient();
      },
      onAbort: async () => {
        await closeMcpClient();
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    await closeMcpClient();

    const message =
      error instanceof Error ? error.message : "Unable to process chat request";

    return Response.json({ error: message }, { status: 500 });
  }
}
