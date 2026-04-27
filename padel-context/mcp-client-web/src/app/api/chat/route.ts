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

  const { messages }: { messages: UIMessage[] } = await request.json();

  const mcpClient = await createMCPClient({
    transport: {
      type: "http",
      url: mcpServerUrl,
    },
  });

  try {
    const tools = await mcpClient.tools();

    const result = streamText({
      model: google(modelId),
      system:
        "Tu es un assistant IA pour l'application Padel Context. Utilise les outils MCP quand c'est pertinent et réponds en français.",
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
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
