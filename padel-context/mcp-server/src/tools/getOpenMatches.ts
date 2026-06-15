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
Searches and lists currently open Padel matches that need players.

Guidelines:
- When to use: Use this tool when a user explicitly wants to find or join an existing Padel match.
- For each match displayed, you MUST explicitly mention the match 'id', 'courtType', 'availableSpots', 'averageLevel', 'hasEquipmentBox', and 'pricePerPerson'. If 'weather' data is present, you MUST display the EXACT temperature, rain probability, and wind speed.

Limitations:
- Do NOT use this tool if the user wants to create a brand new match on an empty court (use 'get-available-slots' instead).
`;

// Schémas de validation des données d'entrée du tool
export const getOpenMatchesInputSchema = z.object({
    city: z.string().optional().describe("Target city."),
    courtType: z
        .enum(["INDOOR", "OUTDOOR", "COVERED"])
        .optional()
        .describe(
            "Preference for the type of court. Use only if explicitly requested.",
        ),
    hasEquipmentBox: z
        .boolean()
        .optional()
        .describe(
            "Set to true ONLY if the user explicitly needs rental rackets and balls.",
        ),
    minPricePerPerson: z
        .number()
        .optional()
        .describe("Minimum budget per person in CHF."),
    maxPricePerPerson: z
        .number()
        .optional()
        .describe("Maximum budget per person in CHF."),
    slotDuration: z
        .number()
        .int()
        .optional()
        .describe("Exact match duration in minutes (e.g., 90 for 1.5 hours)."),
    minSlotDuration: z
        .number()
        .int()
        .optional()
        .describe("Minimum match duration in minutes."),
    maxSlotDuration: z
        .number()
        .int()
        .optional()
        .describe("Maximum match duration in minutes."),
    availableSpots: z
        .number()
        .int()
        .optional()
        .describe("Exact number of open spots the user needs."),
    minAvailableSpots: z
        .number()
        .int()
        .optional()
        .describe(
            "Minimum number of open spots required to accommodate the user's group.",
        ),
    startTimeFrom: isoTimeStr.optional(),
    startTimeTo: isoTimeStr.optional(),
    endTimeFrom: isoTimeStr.optional(),
    endTimeTo: isoTimeStr.optional(),
    participantAverageLevel: z
        .number()
        .optional()
        .describe("The target skill level of the match between 1.0 and 10.0."),
    participantAverageLevelTolerance: z
        .number()
        .optional()
        .describe(
            "Allowed deviation from the target skill level (e.g., 1.0 or 2.0).",
        ),
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
