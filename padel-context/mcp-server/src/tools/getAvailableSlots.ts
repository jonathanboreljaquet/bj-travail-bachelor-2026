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
Searches and lists available Padel time slots by court based on filters.

Guidelines:
- When to use: Use this tool to check court availability when a user wants to play or create a new match.
- CRITICAL GUARDRAIL: The 'city' parameter is mandatory. If the user does not explicitly state a city in their prompt, DO NOT guess or use system context. You MUST abort and ask the user which city they want to play in.
- TIME WINDOW: If the user asks for a specific time, set 'timeFrom' to that time and always add at least 2 hours to calculate 'timeTo'.
- EXHAUSTIVE DISPLAY: When presenting slots, you MUST include all data points returned.
- ORCHESTRATION: Once you present the available slots, ask the user which one they want to book. When they confirm, you MUST trigger the 'create-match-from-slot' tool.

Limitations:
- Do NOT use this tool if the user wants to find or join an ALREADY EXISTING match (use 'get-open-matches' instead).
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

            console.log(
                "Input reçu pour getAvailableSlotsTool :",
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
            const url = `${API_BASE_URL}/available-slots${queryString ? `?${queryString}` : ""}`;
            console.log(
                "URL de l'API pour récupérer les créneaux disponibles :",
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

            const rawAvailableSlots = (await res.json()) as ApiAvailableSlot[];
            console.log(
                "REPONSE BRUTE DE L'API :",
                JSON.stringify(rawAvailableSlots, null, 2),
            );

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
