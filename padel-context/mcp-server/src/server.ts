import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";
import { AsyncLocalStorage } from "node:async_hooks";
import "dotenv/config";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import rateLimit from "express-rate-limit";
import yaml from "yaml";
import {
    CREATE_MATCH_FROM_SLOT_DESC,
    GET_AVAILABLE_SLOTS_DESC,
    GET_OPEN_MATCHES_DESC,
    JOIN_OPEN_MATCH_DESC,
} from "./description";
import {
    availableSlotListVerificationSchema,
    createMatchFromSlotInputSchema,
    createMatchFromSlotOutputSchema,
    createMatchFromSlotVerificationSchema,
    getAvailableSlotsInputSchema,
    getAvailableSlotsOutputSchema,
    getOpenMatchesInputSchema,
    getOpenMatchesOutputSchema,
    joinOpenMatchInputSchema,
    joinOpenMatchOutputSchema,
    joinOpenMatchVerificationSchema,
    matchListVerificationSchema,
    weatherVerificationSchema,
} from "./schemas";

const API_BASE_URL = "http://api:3000/api";
const LOCAL_TIMEZONE = "Europe/Zurich";

const tokenContext = new AsyncLocalStorage<string | undefined>();
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

async function fetchWeatherForOutdoor(postalCode: string, utcDatetime: string) {
    try {
        const res = await fetch(
            `${API_BASE_URL}/weather?postalCode=${encodeURIComponent(
                postalCode,
            )}&datetime=${encodeURIComponent(utcDatetime)}`,
        );

        if (!res.ok) return undefined;

        const payload: unknown = await res.json();

        const data = weatherVerificationSchema.parse(payload);

        if (
            data.precipitationProbabilityPct === null ||
            data.windSpeedKmh === null ||
            data.temperatureCelsius === null
        ) {
            return undefined;
        }

        return {
            precipitationProbabilityPct: data.precipitationProbabilityPct,
            windSpeedKmh: data.windSpeedKmh,
            temperatureCelsius: data.temperatureCelsius,
        };
    } catch (error) {
        console.error("Silent weather fetch error:", error);
        return undefined;
    }
}

const courtTypeTranslations: Record<string, string> = {
    INDOOR: "Intérieur",
    OUTDOOR: "Extérieur",
    COVERED: "Couvert",
};

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
        inputSchema: getAvailableSlotsInputSchema,
        outputSchema: getAvailableSlotsOutputSchema,
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

            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                },
            });

            if (!res.ok) {
                const message = `API request failed (${res.status} ${res.statusText})`;
                return {
                    isError: true,
                    content: [{ type: "text", text: message }],
                };
            }

            const payload: unknown = await res.json();

            const availableSlots =
                availableSlotListVerificationSchema.parse(payload);

            const courtsWithSlots: unknown[] = [];

            await Promise.all(
                availableSlots.map(async (clubData) => {
                    const isOutdoor = clubData.court.type === "OUTDOOR";
                    const postalCode = clubData.court.club.postalCode;

                    const processedSlots = await Promise.all(
                        clubData.availableSlots.map(async (slot) => {
                            let weather = undefined;
                            if (isOutdoor) {
                                const utcDatetime = dayjs(slot.startTime)
                                    .utc()
                                    .format();
                                weather = await fetchWeatherForOutdoor(
                                    postalCode,
                                    utcDatetime,
                                );
                            }
                            return {
                                startTime: dayjs(slot.startTime)
                                    .tz(LOCAL_TIMEZONE)
                                    .format("YYYY-MM-DDTHH:mm:ss"),
                                endTime: dayjs(slot.endTime)
                                    .tz(LOCAL_TIMEZONE)
                                    .format("YYYY-MM-DDTHH:mm:ss"),
                                weather: weather,
                            };
                        }),
                    );

                    if (processedSlots.length === 0) return;

                    courtsWithSlots.push({
                        courtId: clubData.court.id,
                        courtName: clubData.court.name,
                        type: courtTypeTranslations[clubData.court.type],
                        hasEquipmentBox: clubData.court.hasEquipmentBox,
                        price: clubData.court.pricePerPerson,
                        clubName: clubData.court.club.name,
                        city: clubData.court.club.city,
                        availableSlots: processedSlots,
                    });
                }),
            );

            const safeOutput = getAvailableSlotsOutputSchema.parse({
                availableSlots: courtsWithSlots,
            });

            const yamlOptimizedData = safeOutput.availableSlots.map(
                (courtData) => {
                    const schedule: Record<string, string[]> = {};

                    courtData.availableSlots.forEach((slot) => {
                        const [datePart, timePart] = slot.startTime.split("T");
                        const endTimePart = slot.endTime.split("T")[1];

                        const startHour = timePart.substring(0, 5);
                        const endHour = endTimePart.substring(0, 5);

                        let slotStr = `${startHour}-${endHour}`;
                        if (slot.weather) {
                            slotStr += ` (Weather: ${slot.weather.temperatureCelsius}°C|${slot.weather.precipitationProbabilityPct}% rain|${slot.weather.windSpeedKmh}km/h wind)`;
                        }

                        if (!schedule[datePart]) {
                            schedule[datePart] = [];
                        }
                        schedule[datePart].push(slotStr);
                    });

                    return {
                        Court: `${courtData.clubName} (${courtData.city}) | ${courtData.courtName} (ID: ${courtData.courtId})`,
                        Type: courtData.type,
                        EquipmentBox: courtData.hasEquipmentBox
                            ? "Racket and ball rental available on site"
                            : "No equipment available on site",
                        Price: `${courtData.pricePerPerson} CHF`,
                        Schedule: schedule,
                    };
                },
            );

            const finalPromptText =
                yamlOptimizedData.length === 0
                    ? "No slots available."
                    : yaml.stringify(yamlOptimizedData);

            return {
                content: [
                    {
                        type: "text",
                        text: finalPromptText,
                    },
                ],
                structuredContent: safeOutput,
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
        inputSchema: getOpenMatchesInputSchema,
        outputSchema: getOpenMatchesOutputSchema,
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

            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                },
            });

            if (!res.ok) {
                const message = `API request failed (${res.status} ${res.statusText})`;
                return {
                    isError: true,
                    content: [{ type: "text", text: message }],
                };
            }

            const payload: unknown = await res.json();

            const matches = matchListVerificationSchema.parse(payload);

            const flattenedMatches = await Promise.all(
                matches.map(async (match) => {
                    let weather = undefined;

                    if (match.court.type === "OUTDOOR") {
                        const utcDatetime = dayjs(match.startTime)
                            .utc()
                            .format();
                        weather = await fetchWeatherForOutdoor(
                            match.court.club.postalCode,
                            utcDatetime,
                        );
                    }

                    const playersCount = match.participants.length;
                    const averageLevel =
                        match.participants.reduce(
                            (acc, p) => acc + p.user.level,
                            0,
                        ) / playersCount;

                    return {
                        id: match.id,
                        startTime: dayjs(match.startTime)
                            .tz(LOCAL_TIMEZONE)
                            .format("YYYY-MM-DDTHH:mm:ss"),
                        endTime: dayjs(match.endTime)
                            .tz(LOCAL_TIMEZONE)
                            .format("YYYY-MM-DDTHH:mm:ss"),
                        availableSpots: match.availableSpots,
                        courtName: match.court.name,
                        type: courtTypeTranslations[match.court.type],
                        hasEquipmentBox: match.court.hasEquipmentBox,
                        pricePerPerson: match.court.pricePerPerson,
                        duration: match.court.slotDuration,
                        clubName: match.court.club.name,
                        city: match.court.club.city,
                        averageLevel,
                        weather,
                    };
                }),
            );

            const safeOutput = getOpenMatchesOutputSchema.parse({
                matches: flattenedMatches,
            });

            const yamlText = yaml.stringify(safeOutput.matches);

            return {
                content: [
                    {
                        type: "text",
                        text: yamlText,
                    },
                ],
                structuredContent: safeOutput,
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

// MCP TOOL with POST api/matches/:matchId/join
server.registerTool(
    "join-open-match",
    {
        title: "Join open match",
        description: JOIN_OPEN_MATCH_DESC,
        inputSchema: joinOpenMatchInputSchema,
        outputSchema: joinOpenMatchOutputSchema,
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

            const verificationOutput =
                joinOpenMatchVerificationSchema.parse(payload);

            let safeMatch: unknown = undefined;
            if (verificationOutput.match) {
                safeMatch = {
                    id: verificationOutput.match.id,
                    availableSpots: verificationOutput.match.availableSpots,
                };
            }

            const safeOutput = joinOpenMatchOutputSchema.parse({
                message: verificationOutput.message,
                match: safeMatch,
            });

            return {
                content: [{ type: "text", text: yaml.stringify(safeOutput) }],
                structuredContent: safeOutput,
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
        inputSchema: createMatchFromSlotInputSchema,
        outputSchema: createMatchFromSlotOutputSchema,
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

            const verificationOutput =
                createMatchFromSlotVerificationSchema.parse(payload);

            let safeMatch: unknown = undefined;
            if (verificationOutput.match) {
                safeMatch = {
                    id: verificationOutput.match.id,
                    availableSpots: verificationOutput.match.availableSpots,
                };
            }

            const safeOutput = createMatchFromSlotOutputSchema.parse({
                message: verificationOutput.message,
                match: safeMatch,
            });

            return {
                content: [{ type: "text", text: yaml.stringify(safeOutput) }],
                structuredContent: safeOutput,
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

const mcpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: "Too many requests from this IP, please try again later.",
});

app.use("/mcp", mcpLimiter, async (req, res) => {
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
