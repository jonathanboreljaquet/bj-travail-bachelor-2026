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
Searches and lists available Padel matches to join based on filters.

Guidelines:
- When to use: Use this tool when a user wants to find or join an available Padel match.
- CRITICAL GUARDRAIL: The 'city' parameter is mandatory. If the user does not explicitly state a city in their prompt, DO NOT guess or use system context. You MUST abort and ask the user which city they want to play in.
- EXHAUSTIVE DISPLAY: When presenting the matches to the user, you MUST include all data points returned by the tool.
- ORCHESTRATION: Once you present the matches, ask the user which one they want to join. When they confirm, you MUST trigger the 'join-open-match' tool using the match ID.

Limitations:
- Do NOT use this tool if the user wants to create a new match (use 'get-available-slots' instead).
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

            console.log(
                "Input reçu pour getOpenMatchesTool :",
                JSON.stringify(input, null, 2),
            );

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
            console.log(
                "URL de l'API pour récupérer les matchs ouverts :",
                url,
            );

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
            console.log(
                "REPONSE BRUTE DE L'API (Matches) :",
                JSON.stringify(rawMatches, null, 2),
            );

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
