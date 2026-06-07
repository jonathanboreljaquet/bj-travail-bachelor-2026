import * as z from "zod/v4";
import yaml from "yaml";
import dayjs from "dayjs";
import { TextContent } from "@modelcontextprotocol/server";

import {
    API_BASE_URL,
    tokenContext,
    fetchWeatherForOutdoor,
    LOCAL_TIMEZONE,
    courtTypeTranslations,
    isoTimeStr,
    dateParameters,
} from "../utils/utils";

// Description détaillée du tool pour le LLM
const GET_OPEN_MATCHES_DESC = `
Purpose:
Searches and lists currently open Padel matches that need players. It returns match details including start/end times, available spots, average player level, court properties (equipment box, price), and weather information.

Guidelines:
- When to use: Use this tool when a user explicitly wants to find or join an existing, partially filled Padel match.
- You should follow these CRITICAL rules:
  1. The 'city' parameter is MANDATORY. Do not guess it from context. Abort and ask the user if missing.
  2. PAGINATION LIMIT: If the results contain many matches, you MUST strictly display only the first 5 matches.
  3. EXHAUSTIVE AND RAW DATA: For each match displayed, you MUST explicitly mention 'courtType', 'availableSpots', 'averageLevel', 'hasEquipmentBox', and 'pricePerPerson'. If 'weather' data is present, you MUST display the EXACT temperature, rain probability, and wind speed exactly as provided by the tool.
  4. ORCHESTRATION: After presenting up to 5 matches, ask the user if they want to join one or see more. When they confirm, trigger the 'join-open-match' tool using the specific match ID.

Limitations:
- Do NOT use this tool if the user wants to create a brand new match on an empty court (use 'get-available-slots' instead).
- This tool does not join the match for the user; it only retrieves the list.

Parameter Explanation:
- city (string, required): The geographical location to search in.
- availableSpots (integer, optional): Exact number of spots the user needs.
- participantAverageLevel (number, optional): The target skill level of the players.
- hasEquipmentBox (boolean, optional): Filters for matches on courts providing equipment.

Examples:
- User: "Are there any matches I can join in Lausanne tonight?" -> Assistant calls tool with city="Lausanne", startTimeFrom="[tonight 18:00]".
`;

// Schémas de validation des données d'entrée du tools
export const getOpenMatchesInputSchema = z.object({
    city: z
        .string()
        .describe(
            "Target city. MUST be explicitly stated by the user. If missing, do not guess, abort the tool call and ask the user.",
        ),
    courtType: z.enum(["INDOOR", "OUTDOOR", "COVERED"]).optional(),
    hasEquipmentBox: z.boolean().optional(),
    minPricePerPerson: z.number().optional(),
    maxPricePerPerson: z.number().optional(),
    slotDuration: z.number().int().optional(),
    minSlotDuration: z.number().int().optional(),
    maxSlotDuration: z.number().int().optional(),
    availableSpots: z.number().int().optional(),
    minAvailableSpots: z.number().int().optional(),
    startTimeFrom: isoTimeStr.optional(),
    startTimeTo: isoTimeStr.optional(),
    endTimeFrom: isoTimeStr.optional(),
    endTimeTo: isoTimeStr.optional(),
    participantAverageLevel: z.number().optional(),
    participantAverageLevelTolerance: z.number().optional(),
});

// Interface pour typer la réponse brute de l'API REST
interface ApiMatch {
    id: number;
    startTime: string;
    endTime: string;
    status: string;
    availableSpots: number;
    court: {
        name: string;
        type: string;
        hasEquipmentBox: boolean;
        pricePerPerson: number;
        slotDuration: number;
        club: {
            name: string;
            city: string;
            postalCode: string;
            openingTime: string;
            closingTime: string;
        };
    };
    participants: Array<{
        user: {
            firstname: string;
            level: number;
        };
    }>;
}

// Définition du tool
export const getOpenMatchesTool = {
    name: "get-open-matches",
    config: {
        title: "Open matches",
        description: GET_OPEN_MATCHES_DESC,
        inputSchema: getOpenMatchesInputSchema,
    },
    handler: async (rawInput: z.infer<typeof getOpenMatchesInputSchema>) => {
        try {
            const input = getOpenMatchesInputSchema.parse(rawInput);

            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(input)) {
                if (value != null) {
                    if (
                        dateParameters.includes(key) &&
                        typeof value === "string"
                    ) {
                        const utcDateString = dayjs
                            .tz(value, LOCAL_TIMEZONE)
                            .utc()
                            .format();
                        searchParams.set(key, utcDateString);
                    } else {
                        searchParams.set(key, String(value));
                    }
                }
            }
            const queryString = searchParams.toString();
            const url = `${API_BASE_URL}/matches${queryString ? `?${queryString}` : ""}`;

            const jwtToken = tokenContext.getStore();
            if (!jwtToken) {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: "Unauthorized: Missing JWT token in HTTP headers.",
                        } as TextContent,
                    ],
                };
            }

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${jwtToken}` },
            });
            if (!res.ok) {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: `API request failed (${res.status} ${res.statusText})`,
                        } as TextContent,
                    ],
                };
            }

            const rawMatches = (await res.json()) as ApiMatch[];

            if (!rawMatches.length) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "No open matches available matching these criteria.",
                        } as TextContent,
                    ],
                };
            }

            // Optimisation du format de la réponse pour le LLM
            const optimizedMatches = await Promise.all(
                rawMatches.map(async (match) => {
                    const isOutdoor = match.court.type === "OUTDOOR";
                    const postalCode = match.court.club.postalCode;

                    const start = dayjs(match.startTime).tz(LOCAL_TIMEZONE);
                    const end = dayjs(match.endTime).tz(LOCAL_TIMEZONE);

                    const dateKey = start.format("YYYY-MM-DD");
                    const timeRange = `${start.format("HH:mm")}-${end.format("HH:mm")}`;

                    let weatherInfo = undefined;
                    if (isOutdoor) {
                        const utcDatetime = start.utc().format();
                        const weather = await fetchWeatherForOutdoor(
                            postalCode,
                            utcDatetime,
                        );
                        if (weather) {
                            weatherInfo = `[${weather.temperatureCelsius}°C, ${weather.precipitationProbabilityPct}% rain, ${weather.windSpeedKmh}km/h wind]`;
                        }
                    }

                    const playersCount = match.participants.length;
                    const averageLevel =
                        playersCount > 0
                            ? match.participants.reduce(
                                  (acc, p) => acc + p.user.level,
                                  0,
                              ) / playersCount
                            : 0;

                    return {
                        id: match.id,
                        date: dateKey,
                        time: timeRange,
                        availableSpots: match.availableSpots,
                        averageLevel: parseFloat(averageLevel.toFixed(1)),
                        court: {
                            name: match.court.name,
                            type: courtTypeTranslations[match.court.type],
                            hasEquipmentBox: match.court.hasEquipmentBox,
                            pricePerPerson: match.court.pricePerPerson + "CHF",
                            club: `${match.court.club.name} (${match.court.club.city})`,
                        },
                        ...(weatherInfo ? { weather: weatherInfo } : {}),
                    };
                }),
            );

            return {
                content: [
                    {
                        type: "text",
                        text: yaml.stringify(optimizedMatches),
                    } as TextContent,
                ],
            };
        } catch (error) {
            const message =
                error instanceof Error
                    ? `Unable to retrieve open matches: ${error.message}`
                    : "Unable to retrieve open matches";

            return {
                isError: true,
                content: [{ type: "text", text: message } as TextContent],
            };
        }
    },
};
