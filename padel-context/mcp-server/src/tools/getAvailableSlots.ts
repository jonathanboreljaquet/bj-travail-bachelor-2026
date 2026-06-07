import * as z from "zod/v4";
import yaml from "yaml";

import {
    API_BASE_URL,
    tokenContext,
    fetchWeatherForOutdoor,
    LOCAL_TIMEZONE,
    courtTypeTranslations,
    isoTimeStr,
    dateParameters,
} from "../utils/utils";
import { TextContent } from "@modelcontextprotocol/server";
import dayjs from "dayjs";

// Description détaillée de du tool pour le LLM
const GET_AVAILABLE_SLOTS_DESC = `
Purpose:
Searches and lists available Padel time slots by court based on filters. It returns structured data including court details (type, price, equipment box availability, club info), available time ranges, and outdoor weather forecasts.

Guidelines:
- When to use: Use this tool to check court availability when a user wants to play or create a new match.
- You should follow these CRITICAL rules:
  1. The 'city' parameter is MANDATORY. Do not guess it. If missing, abort the tool call and ask the user.
  2. If the user specifies a time, set 'timeFrom' and add at least 2 hours to calculate 'timeTo'.
  3. PAGINATION LIMIT: If the tool returns a large list, you MUST strictly display only the first 5 slots.
  4. EXHAUSTIVE AND RAW DATA: For each slot displayed, you MUST explicitly mention 'courtType', 'availableSpots', 'hasEquipmentBox', and 'pricePerPerson'. If 'weather' data is present, you MUST display the EXACT temperature, rain probability, and wind speed exactly as provided by the tool.
  5. ORCHESTRATION: After displaying up to 5 slots, ask the user if they want to see more options or if they want to book one. When they confirm a booking, trigger the 'create-match-from-slot' tool.

Limitations:
- Do NOT use this tool if the user wants to find or join an ALREADY EXISTING match (use 'get-open-matches' instead).
- This tool only returns available blank slots; it does not book them.

Parameter Explanation:
- city (string, required): The target geographical location.
- courtType (string, optional): Preference for INDOOR, OUTDOOR, or COVERED.
- timeFrom / timeTo (string, optional): ISO time strings defining the search window.
- hasEquipmentBox (boolean, optional): Filters for courts that provide playing equipment.

Examples:
- User: "I want to play in Geneva tomorrow morning." -> Assistant calls tool with city="Geneva", timeFrom="[tomorrow 08:00]", timeTo="[tomorrow 12:00]".
`;

// Schémas de validation des données d'entrée du tool
export const getAvailableSlotsInputSchema = z.object({
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
    timeFrom: isoTimeStr.optional(),
    timeTo: isoTimeStr.optional(),
});

// Interface pour typer la réponse brute de l'API REST
interface ApiAvailableSlot {
    court: {
        id: number;
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
    availableSlots: Array<{
        startTime: string;
        endTime: string;
    }>;
}

// Définition du tool
export const getAvailableSlotsTool = {
    name: "get-available-slots",
    config: {
        title: "Available slots",
        description: GET_AVAILABLE_SLOTS_DESC,
        inputSchema: getAvailableSlotsInputSchema,
    },
    handler: async (rawInput: z.infer<typeof getAvailableSlotsInputSchema>) => {
        try {
            const input = getAvailableSlotsInputSchema.parse(rawInput);

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
            const url = `${API_BASE_URL}/available-slots${queryString ? `?${queryString}` : ""}`;

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

            const rawAvailableSlots = (await res.json()) as ApiAvailableSlot[];

            if (!rawAvailableSlots.length) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "No slots available.",
                        } as TextContent,
                    ],
                };
            }

            // Optimisation du format de la réponse afin de minimiser l'halucination du LLM et son cout en tokens
            const optimizedSlots = await Promise.all(
                rawAvailableSlots.map(async (item) => {
                    const isOutdoor = item.court.type === "OUTDOOR";
                    const postalCode = item.court.club.postalCode;

                    const slotsByDate: Record<string, string[]> = {};

                    const processedSlots = await Promise.all(
                        item.availableSlots.map(async (slot) => {
                            const start = dayjs(slot.startTime).tz(
                                LOCAL_TIMEZONE,
                            );
                            const end = dayjs(slot.endTime).tz(LOCAL_TIMEZONE);

                            const dateKey = start.format("YYYY-MM-DD");
                            const timeRange = `${start.format("HH:mm")}-${end.format("HH:mm")}`;

                            let weatherInfo = "";

                            if (isOutdoor) {
                                const utcDatetime = start.utc().format();
                                const weather = await fetchWeatherForOutdoor(
                                    postalCode,
                                    utcDatetime,
                                );

                                if (weather) {
                                    weatherInfo = `[${weather.temperatureCelsius}°C, ${weather.precipitationProbabilityPct}%rain, ${weather.windSpeedKmh}km/h wind]`;
                                }
                            }

                            return { dateKey, value: timeRange + weatherInfo };
                        }),
                    );

                    for (const { dateKey, value } of processedSlots) {
                        if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
                        slotsByDate[dateKey].push(value);
                    }

                    return {
                        court: {
                            id: item.court.id,
                            name: item.court.name,
                            type: courtTypeTranslations[item.court.type],
                            hasEquipmentBox: item.court.hasEquipmentBox,
                            pricePerPerson: item.court.pricePerPerson + "CHF",
                            club: `${item.court.club.name} (${item.court.club.city})`,
                        },
                        slots: slotsByDate,
                    };
                }),
            );

            return {
                content: [
                    {
                        type: "text",
                        text: yaml.stringify(optimizedSlots),
                    } as TextContent,
                ],
            };
        } catch (error) {
            const message =
                error instanceof Error
                    ? `Unable to retrieve available slots: ${error.message}`
                    : "Unable to retrieve available slots";

            return {
                isError: true,
                content: [{ type: "text", text: message } as TextContent],
            };
        }
    },
};
