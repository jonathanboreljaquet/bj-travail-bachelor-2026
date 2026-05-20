import { cookies } from "next/headers";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMCPClient } from "@ai-sdk/mcp";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

export const runtime = "nodejs";

const modelId = process.env.GEMINI_MODEL ?? "models/gemma-4-26b-a4b-it";
const mcpServerUrl = "http://mcp-server:3001/mcp";

const google = createGoogleGenerativeAI({
  apiKey:
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.MCP_CLIENT_GEMINI_API_KEY,
});

export async function POST(request: Request) {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.MCP_CLIENT_GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        error:
          "Missing API key. Set GOOGLE_GENERATIVE_AI_API_KEY (or MCP_CLIENT_GEMINI_API_KEY).",
      },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const jwtToken = cookieStore.get("padel_context_jwt_token")?.value;

  const { messages }: { messages: UIMessage[] } = await request.json();

  const mcpClient = await createMCPClient({
    transport: {
      type: "http",
      url: mcpServerUrl,
      headers: jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    },
  });

  try {
    const tools = await mcpClient.tools();
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
    Tu es un assistant IA pour l'application Padel Context.
    Ton rôle est d'aider les utilisateurs à trouver et réserver des terrains de padel.
    Utilise les outils MCP fournis quand c'est pertinent. Réponds en français de manière concise.
    INFORMATIONS DE CONTEXTE IMPORTANTES :
    - Date actuelle : ${dayOfWeek} ${currentDate}
    - Heure locale : ${currentTime} (Heure de Genève, CET/CEST)
    - Si l'utilisateur demande "demain" ou "aujourd'hui", réfère-toi strictement à la date ci-dessus pour tes recherches.
    `.trim();

    const result = streamText({
      model: google(modelId),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      experimental_telemetry: {
        isEnabled: true,
        functionId: "padel-context-mcp",
      },
    });

    return result.toUIMessageStreamResponse({
      onFinish: async () => {
        await mcpClient.close();
      },
    });
  } catch (error) {
    await mcpClient.close();

    const message =
      error instanceof Error ? error.message : "Unable to process chat request";

    return Response.json({ error: message }, { status: 500 });
  }
}
