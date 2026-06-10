import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";
import "dotenv/config";
import { getAvailableSlotsTool } from "./tools/getAvailableSlots";
import { getOpenMatchesTool } from "./tools/getOpenMatches";
import { joinOpenMatchTool } from "./tools/joinOpenMatch";
import { createMatchFromSlotTool } from "./tools/createMatchFromSlot";

import { tokenContext } from "./utils/utils";

const server = new McpServer({
    name: "padel-context-mcp-server",
    version: "1.0.0",
});
const app = createMcpExpressApp({
    host: "0.0.0.0",
    allowedHosts: ["mcp-server", "localhost", "127.0.0.1", "[::1]"],
});

const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
});

// Tool MCP avec l'endpoint GET api/available-slots
server.registerTool(
    getAvailableSlotsTool.name,
    getAvailableSlotsTool.config,
    getAvailableSlotsTool.handler,
);

// Tool MCP avec l'endpoint GET api/matches
server.registerTool(
    getOpenMatchesTool.name,
    getOpenMatchesTool.config,
    getOpenMatchesTool.handler,
);

// Tool MCP avec l'endpoint POST api/matches/:matchId/join
server.registerTool(
    joinOpenMatchTool.name,
    joinOpenMatchTool.config,
    joinOpenMatchTool.handler,
);

// Tool MCP avec l'endpoint POST api/matches/from-slot
server.registerTool(
    createMatchFromSlotTool.name,
    createMatchFromSlotTool.config,
    createMatchFromSlotTool.handler,
);

const MCP_INTERNAL_SECRET = process.env.MCP_INTERNAL_SECRET;

app.use("/mcp", async (req, res) => {
    if (
        MCP_INTERNAL_SECRET &&
        req.headers["internal-secret"] !== MCP_INTERNAL_SECRET
    ) {
        res.status(403).json({ error: "Forbidden: invalid internal secret." });
        return;
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : undefined;

    tokenContext.run(token, async () => {
        await transport.handleRequest(req, res, req.body);
    });
});

await server.connect(transport);

const PORT = 3001;

app.listen(PORT, "0.0.0.0", (error) => {
    console.log(`MCP server is running on 0.0.0.0:${PORT}/mcp`);
    if (error) {
        console.error("Failed to start MCP server:", error);
        process.exit(1);
    }
});
