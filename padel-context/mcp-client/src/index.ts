import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  ChatSession,
  FunctionDeclaration,
  GoogleGenerativeAI,
  GenerateContentResult,
} from "@google/generative-ai";
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const apiKey = process.env.MCP_CLIENT_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("MCP_CLIENT_GEMINI_API_KEY manquante dans le fichier .env");
}

const modelName =
  process.env.MCP_CLIENT_GEMINI_MODEL ?? "models/gemma-4-26b-a4b-it";
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: modelName });

// Transforme la sortie brute d'un tool MCP en texte simple pour Gemini.
function extractToolTextContent(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (
        item &&
        typeof item === "object" &&
        "text" in item &&
        typeof (item as { text?: unknown }).text === "string"
      ) {
        return (item as { text: string }).text;
      }

      return "";
    })
    .filter((text) => text.length > 0)
    .join("\n");
}

// Garantit que les arguments envoyés à MCP sont un objet JSON simple.
function toToolArguments(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// Retire les champs JSON Schema que Gemini n'accepte pas.
function sanitizeSchemaForGemini(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(sanitizeSchemaForGemini);
  }

  if (!schema || typeof schema !== "object") {
    return schema;
    // Boucle tool-calling: Gemini demande un tool, MCP l'exécute, puis on renvoie le résultat.
  }

  const cleanedEntries = Object.entries(schema)
    // Gemini rejects JSON Schema meta keys like "$schema".
    .filter(([key]) => !key.startsWith("$"))
    .map(([key, value]) => [key, sanitizeSchemaForGemini(value)] as const);

  return Object.fromEntries(cleanedEntries);
}

async function resolveToolCalls(
  chat: ChatSession,
  mcpClient: Client,
  initialResult: GenerateContentResult,
): Promise<string> {
  let result = initialResult;

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const response = result.response;
    const functionCalls = response.functionCalls() ?? [];

    if (functionCalls.length === 0) {
      return response.text();
    }

    const functionResponses = [] as Array<{
      functionResponse: {
        name: string;
        response: { result: string };
      };
    }>;

    for (const call of functionCalls) {
      console.log(`Tool call -> ${call.name}`);

      const mcpResult = await mcpClient.callTool({
        name: call.name,
        arguments: toToolArguments(call.args),
      });

      const textResult = extractToolTextContent(mcpResult.content);
      functionResponses.push({
        functionResponse: {
          name: call.name,
          response: {
            result:
              textResult || JSON.stringify(mcpResult.structuredContent ?? {}),
          },
        },
      });
    }

    result = await chat.sendMessage(functionResponses);
  }

  throw new Error("Trop d'appels d'outils consecutifs. Arret de securite.");
}

// Point d'entrée du programme: connexion MCP, chargement des tools et chat interactif.
async function main() {
  const transport = new StreamableHTTPClientTransport(
    new URL("http://mcp-server:3001/mcp"),
  );

  // Identité du client côté serveur MCP.
  const mcpClient = new Client(
    {
      name: "padel-context-mcp-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  await mcpClient.connect(transport);
  console.log(`Connecté au serveur MCP : http://mcp-server:3001/mcp`);

  // Récupère la liste des outils exposés par le serveur MCP.

  const mcpToolsResponse = await mcpClient.listTools();
  console.log(`${mcpToolsResponse.tools.length} outil(s) MCP detecte(s)`);
  for (const tool of mcpToolsResponse.tools) {
    console.log(`- ${tool.name}`);
  }

  // Convertit les tools MCP au format attendu par Gemini.
  const geminiTools: FunctionDeclaration[] = mcpToolsResponse.tools.map(
    (tool) => ({
      name: tool.name,
      description: tool.description ?? "MCP tool",
      parameters: sanitizeSchemaForGemini(
        tool.inputSchema,
      ) as FunctionDeclaration["parameters"],
    }),
  );

  // Ouvre la session Gemini avec les tools MCP disponibles.
  const chat = model.startChat({
    tools: [{ functionDeclarations: geminiTools }],
  });

  // Lecture des messages utilisateur dans le terminal.
  const rl = createInterface({ input, output });
  console.log(`Model utilisé : ${modelName}`);
  console.log('Tape ton message (ou "exit" pour quitter).\n');

  try {
    while (true) {
      // Attend un message utilisateur.
      const userPrompt = (await rl.question("Vous > ")).trim();

      if (!userPrompt) {
        continue;
      }

      if (["exit", "quit", "q"].includes(userPrompt.toLowerCase())) {
        break;
      }

      // Envoie le message au modèle, puis exécute si besoin les tools demandés.
      const initialResult = await chat.sendMessage(userPrompt);
      const assistantReply = await resolveToolCalls(
        chat,
        mcpClient,
        initialResult,
      );

      console.log(`Gemma > ${assistantReply}\n`);
    }
  } catch (error) {
    console.error("Erreur:", error);
  } finally {
    rl.close();
    await transport.close();
    console.log("Connexion MCP fermee.");
  }
}

main();
