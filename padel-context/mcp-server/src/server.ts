import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";
import "dotenv/config";
import * as z from "zod/v4";
import { GET_OPEN_MATCHES_DESC } from "./description";

const APP_PORT = process.env.APP_PORT ?? 3001;
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000/api";

const matchSchema = z.object({
  id: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.string(),
  availableSpots: z.number(),
  court: z.object({
    name: z.string(),
    type: z.string(),
    hasEquipmentBox: z.boolean(),
    pricePerPerson: z.number(),
    slotDuration: z.number(),
    club: z.object({
      name: z.string(),
      city: z.string(),
      openingTime: z.string(),
      closingTime: z.string(),
    }),
  }),
  participants: z.array(
    z.object({
      user: z.object({
        firstname: z.string(),
        lastname: z.string(),
        email: z.string(),
        level: z.number(),
      }),
    }),
  ),
});

const server = new McpServer({
  name: "padel-context-mcp-server",
  version: "1.0.0",
});
const app = createMcpExpressApp();

const transport = new NodeStreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true,
});

server.registerTool(
  "get-open-matches",
  {
    title: "Open Matches",
    description: GET_OPEN_MATCHES_DESC,
    inputSchema: z.object({
      city: z.string().optional(),
      courtType: z.enum(["INDOOR", "OUTDOOR", "COVERED"]).optional(),
      hasEquipmentBox: z.boolean().optional(),
      minPricePerPerson: z.number().optional(),
      maxPricePerPerson: z.number().optional(),
      slotDuration: z.number().int().optional(),
      minSlotDuration: z.number().int().optional(),
      maxSlotDuration: z.number().int().optional(),
      availableSpots: z.number().int().optional(),
      minAvailableSpots: z.number().int().optional(),
      startTimeFrom: z.iso.datetime().optional(),
      startTimeTo: z.iso.datetime().optional(),
      endTimeFrom: z.iso.datetime().optional(),
      endTimeTo: z.iso.datetime().optional(),
      participantAverageLevel: z.number().optional(),
      participantAverageLevelTolerance: z.number().optional(),
    }),
    outputSchema: z.object({ matches: z.array(matchSchema) }),
  },
  async (input) => {
    try {
      const searchParams = new URLSearchParams();

      for (const [key, value] of Object.entries(input)) {
        if (value === undefined || value === null) {
          continue;
        }

        searchParams.set(key, String(value));
      }

      const queryString = searchParams.toString();
      const url = `${API_BASE_URL}/matches${
        queryString ? `?${queryString}` : ""
      }`;

      const res = await fetch(url);

      if (!res.ok) {
        const message = `API request failed (${res.status} ${res.statusText})`;
        return {
          isError: true,
          content: [{ type: "text", text: message }],
        };
      }

      const payload: unknown = await res.json();
      const matches = z.array(matchSchema).parse(payload);

      return {
        content: [{ type: "text", text: JSON.stringify({ matches }) }],
        structuredContent: { matches },
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? `Unable to retrieve open matches: ${error.message}`
          : "Unable to retrieve open matches";

      return {
        isError: true,
        content: [{ type: "text", text: message }],
      };
    }
  },
);

app.post("/mcp", async (req, res) => {
  await transport.handleRequest(req, res, req.body);
});

await server.connect(transport);

app.listen(APP_PORT, (error) => {
  console.log(`MCP server is running on localhost:${APP_PORT}/mcp`);
  if (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
});
