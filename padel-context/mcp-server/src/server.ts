import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";
import { AsyncLocalStorage } from "node:async_hooks";
import "dotenv/config";
import * as z from "zod/v4";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import {
    CREATE_MATCH_FROM_SLOT_DESC,
    GET_AVAILABLE_SLOTS_DESC,
    GET_OPEN_MATCHES_DESC,
    GET_WEATHER_DESC,
    JOIN_OPEN_MATCH_DESC,
} from "./description";

const API_BASE_URL = "http://api:3000/api";

const tokenContext = new AsyncLocalStorage<string | undefined>();

const LOCAL_TIMEZONE = "Europe/Zurich";
dayjs.extend(utc);
dayjs.extend(timezone);

const dateParameters = [
    "timeFrom",
    "timeTo",
    "startTimeFrom",
    "startTimeTo",
    "endTimeFrom",
    "endTimeTo",
    "startTime",
    "endTime",
    "datetime",
];

const availableSlotSchema = z.object({
    court: z.object({
        id: z.number(),
        name: z.string(),
        type: z.string(),
        hasEquipmentBox: z.boolean(),
        pricePerPerson: z.number(),
        slotDuration: z.number(),
        club: z.object({
            name: z.string(),
            city: z.string(),
            postalCode: z.string(),
            openingTime: z.string(),
            closingTime: z.string(),
        }),
    }),
    availableSlots: z.array(
        z.object({
            startTime: z.string(),
            endTime: z.string(),
        }),
    ),
});

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
            postalCode: z.string(),
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

const joinedMatchSchema = z.object({
    id: z.number(),
    status: z.string(),
    availableSpots: z.number(),
    startTime: z.string(),
    endTime: z.string(),
    creator_id: z.number(),
    court: z.object({
        name: z.string(),
        type: z.string(),
        club: z.object({
            name: z.string(),
            city: z.string(),
        }),
    }),
    participants: z.array(
        z.object({
            user: z.object({
                id: z.number(),
                firstname: z.string(),
                lastname: z.string(),
                email: z.email(),
                level: z.number(),
            }),
            joinedAt: z.string(),
        }),
    ),
});

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

// MCP TOOL WITH GET api/available-slots
server.registerTool(
    "get-available-slots",
    {
        title: "Available slots",
        description: GET_AVAILABLE_SLOTS_DESC,
        inputSchema: z.object({
            city: z.string().optional(),
            courtType: z.enum(["INDOOR", "OUTDOOR", "COVERED"]).optional(),
            hasEquipmentBox: z.boolean().optional(),
            minPricePerPerson: z.number().optional(),
            maxPricePerPerson: z.number().optional(),
            slotDuration: z.number().int().optional(),
            minSlotDuration: z.number().int().optional(),
            maxSlotDuration: z.number().int().optional(),
            timeFrom: z
                .string()
                .describe(
                    "Local time strictly in 'YYYY-MM-DDTHH:mm:ss' format.",
                )
                .optional(),
            timeTo: z
                .string()
                .describe(
                    "Local time strictly in 'YYYY-MM-DDTHH:mm:ss' format.",
                )
                .optional(),
        }),
        outputSchema: z.object({
            availableSlots: z.array(availableSlotSchema),
        }),
    },
    async (input) => {
        try {
            const searchParams = new URLSearchParams();

            for (const [key, value] of Object.entries(input)) {
                if (value === undefined || value === null) continue;

                if (dateParameters.includes(key) && typeof value === "string") {
                    const utcDateString = dayjs
                        .tz(value, LOCAL_TIMEZONE)
                        .utc()
                        .format();
                    searchParams.set(key, utcDateString);
                } else {
                    searchParams.set(key, String(value));
                }
            }

            const queryString = searchParams.toString();
            const url = `${API_BASE_URL}/available-slots${
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

            const availableSlots = z.array(availableSlotSchema).parse(payload);

            availableSlots.forEach((club) => {
                club.availableSlots.forEach((slot) => {
                    slot.startTime = dayjs(slot.startTime)
                        .tz(LOCAL_TIMEZONE)
                        .format("YYYY-MM-DDTHH:mm:ss");
                    slot.endTime = dayjs(slot.endTime)
                        .tz(LOCAL_TIMEZONE)
                        .format("YYYY-MM-DDTHH:mm:ss");
                });
            });

            return {
                content: [
                    { type: "text", text: JSON.stringify({ availableSlots }) },
                ],
                structuredContent: { availableSlots },
            };
        } catch (error) {
            const message =
                error instanceof Error
                    ? `Unable to retrieve available slots: ${error.message}`
                    : "Unable to retrieve available slots";

            return {
                isError: true,
                content: [{ type: "text", text: message }],
            };
        }
    },
);

// MCP TOOL with GET api/matches
server.registerTool(
    "get-open-matches",
    {
        title: "Open matches",
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
            startTimeFrom: z
                .string()
                .describe(
                    "Local time strictly in 'YYYY-MM-DDTHH:mm:ss' format.",
                )
                .optional(),
            startTimeTo: z
                .string()
                .describe(
                    "Local time strictly in 'YYYY-MM-DDTHH:mm:ss' format.",
                )
                .optional(),
            endTimeFrom: z
                .string()
                .describe(
                    "Local time strictly in 'YYYY-MM-DDTHH:mm:ss' format.",
                )
                .optional(),
            endTimeTo: z
                .string()
                .describe(
                    "Local time strictly in 'YYYY-MM-DDTHH:mm:ss' format.",
                )
                .optional(),
            participantAverageLevel: z.number().optional(),
            participantAverageLevelTolerance: z.number().optional(),
        }),
        outputSchema: z.object({ matches: z.array(matchSchema) }),
    },
    async (input) => {
        try {
            const searchParams = new URLSearchParams();

            for (const [key, value] of Object.entries(input)) {
                if (value === undefined || value === null) continue;

                if (dateParameters.includes(key) && typeof value === "string") {
                    const utcDateString = dayjs
                        .tz(value, LOCAL_TIMEZONE)
                        .utc()
                        .format();
                    searchParams.set(key, utcDateString);
                } else {
                    searchParams.set(key, String(value));
                }
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

            matches.forEach((match) => {
                match.startTime = dayjs(match.startTime)
                    .tz(LOCAL_TIMEZONE)
                    .format("YYYY-MM-DDTHH:mm:ss");
                match.endTime = dayjs(match.endTime)
                    .tz(LOCAL_TIMEZONE)
                    .format("YYYY-MM-DDTHH:mm:ss");
            });

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

//MCP TOOL WITH GET api/weather
server.registerTool(
    "get-weather",
    {
        title: "Get weather",
        description: GET_WEATHER_DESC,
        inputSchema: z.object({
            postalCode: z.string(),
            datetime: z
                .string()
                .describe(
                    "Local time strictly in 'YYYY-MM-DDTHH:mm:ss' format.",
                ),
        }),
        outputSchema: z.object({
            precipitationProbabilityPct: z.number(),
            windSpeedKmh: z.number(),
            temperatureCelsius: z.number(),
        }),
    },
    async ({ postalCode, datetime }) => {
        try {
            const utcDatetime = dayjs
                .tz(datetime, LOCAL_TIMEZONE)
                .utc()
                .format();

            const res = await fetch(
                `${API_BASE_URL}/weather?postalCode=${encodeURIComponent(
                    postalCode,
                )}&datetime=${encodeURIComponent(utcDatetime)}`,
            );

            if (!res.ok) {
                const message = `API request failed (${res.status} ${res.statusText})`;
                return {
                    isError: true,
                    content: [{ type: "text", text: message }],
                };
            }

            const weatherData: unknown = await res.json();

            const output = z
                .object({
                    precipitationProbabilityPct: z.number(),
                    windSpeedKmh: z.number(),
                    temperatureCelsius: z.number(),
                })
                .parse(weatherData);

            return {
                content: [{ type: "text", text: JSON.stringify(output) }],
                structuredContent: output,
            };
        } catch (error) {
            const message =
                error instanceof Error
                    ? `Unable to get weather: ${error.message}`
                    : "Unable to get weather";

            return {
                isError: true,
                content: [{ type: "text", text: message }],
            };
        }
    },
);

// MCP TOOL with POST api/matches/:matchId/join
server.registerTool(
    "join-open-match",
    {
        title: "Join open match",
        description: JOIN_OPEN_MATCH_DESC,
        inputSchema: z.object({
            matchId: z.number().int().nonoptional(),
        }),
        outputSchema: z.object({
            message: z.string(),
            match: joinedMatchSchema,
        }),
    },
    async ({ matchId }) => {
        try {
            const jwtToken = tokenContext.getStore();

            if (!jwtToken) {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: "Unauthorized: Missing JWT token in HTTP headers.",
                        },
                    ],
                };
            }

            const res = await fetch(`${API_BASE_URL}/matches/${matchId}/join`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                },
            });

            const payload: unknown = await res.json();

            if (!res.ok) {
                const errorMessage =
                    typeof payload === "object" &&
                    payload !== null &&
                    "message" in payload &&
                    typeof (payload as { message?: unknown }).message ===
                        "string"
                        ? (payload as { message: string }).message
                        : `Join match failed (${res.status} ${res.statusText})`;

                return {
                    isError: true,
                    content: [{ type: "text", text: errorMessage }],
                };
            }

            const output = z
                .object({
                    message: z.string(),
                    match: joinedMatchSchema,
                })
                .parse(payload);

            if (output.match) {
                if (output.match.startTime) {
                    output.match.startTime = dayjs(output.match.startTime)
                        .tz(LOCAL_TIMEZONE)
                        .format("YYYY-MM-DDTHH:mm:ss");
                }
                if (output.match.endTime) {
                    output.match.endTime = dayjs(output.match.endTime)
                        .tz(LOCAL_TIMEZONE)
                        .format("YYYY-MM-DDTHH:mm:ss");
                }

                if (Array.isArray(output.match.participants)) {
                    output.match.participants.forEach((p) => {
                        if (p.joinedAt) {
                            p.joinedAt = dayjs(p.joinedAt)
                                .tz(LOCAL_TIMEZONE)
                                .format("YYYY-MM-DDTHH:mm:ss");
                        }
                    });
                }
            }

            return {
                content: [{ type: "text", text: JSON.stringify(output) }],
                structuredContent: output,
            };
        } catch (error) {
            const message =
                error instanceof Error
                    ? `Unable to join match: ${error.message}`
                    : "Unable to join match";

            return {
                isError: true,
                content: [{ type: "text", text: message }],
            };
        }
    },
);

// MCP TOOL with POST api/matches/from-slot
server.registerTool(
    "create-match-from-slot",
    {
        title: "Create match from slot",
        description: CREATE_MATCH_FROM_SLOT_DESC,
        inputSchema: z.object({
            courtId: z.number().int().min(1),
            startTime: z
                .string()
                .describe(
                    "Local time strictly in 'YYYY-MM-DDTHH:mm:ss' format.",
                ),
            endTime: z
                .string()
                .describe(
                    "Local time strictly in 'YYYY-MM-DDTHH:mm:ss' format.",
                ),
        }),
        outputSchema: z.object({
            message: z.string(),
            match: joinedMatchSchema,
        }),
    },
    async ({ courtId, startTime, endTime }) => {
        try {
            const jwtToken = tokenContext.getStore();

            if (!jwtToken) {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: "Unauthorized: Missing JWT token in HTTP headers.",
                        },
                    ],
                };
            }

            const utcStartTime = dayjs
                .tz(startTime, LOCAL_TIMEZONE)
                .utc()
                .format();
            const utcEndTime = dayjs.tz(endTime, LOCAL_TIMEZONE).utc().format();

            const res = await fetch(`${API_BASE_URL}/matches/from-slot`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${jwtToken}`,
                },
                body: JSON.stringify({
                    courtId,
                    startTime: utcStartTime,
                    endTime: utcEndTime,
                }),
            });

            const payload: unknown = await res.json();

            if (!res.ok) {
                const errorMessage =
                    typeof payload === "object" &&
                    payload !== null &&
                    "message" in payload &&
                    typeof (payload as { message?: unknown }).message ===
                        "string"
                        ? (payload as { message: string }).message
                        : `Create match failed (${res.status} ${res.statusText})`;

                return {
                    isError: true,
                    content: [{ type: "text", text: errorMessage }],
                };
            }

            const output = z
                .object({
                    message: z.string(),
                    match: joinedMatchSchema,
                })
                .parse(payload);

            if (output.match) {
                if (output.match.startTime) {
                    output.match.startTime = dayjs(output.match.startTime)
                        .tz(LOCAL_TIMEZONE)
                        .format("YYYY-MM-DDTHH:mm:ss");
                }
                if (output.match.endTime) {
                    output.match.endTime = dayjs(output.match.endTime)
                        .tz(LOCAL_TIMEZONE)
                        .format("YYYY-MM-DDTHH:mm:ss");
                }

                if (Array.isArray(output.match.participants)) {
                    output.match.participants.forEach((p) => {
                        if (p.joinedAt) {
                            p.joinedAt = dayjs(p.joinedAt)
                                .tz(LOCAL_TIMEZONE)
                                .format("YYYY-MM-DDTHH:mm:ss");
                        }
                    });
                }
            }

            return {
                content: [{ type: "text", text: JSON.stringify(output) }],
                structuredContent: output,
            };
        } catch (error) {
            const message =
                error instanceof Error
                    ? `Unable to create match from slot: ${error.message}`
                    : "Unable to create match from slot";

            return {
                isError: true,
                content: [{ type: "text", text: message }],
            };
        }
    },
);

app.use("/mcp", async (req, res) => {
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
