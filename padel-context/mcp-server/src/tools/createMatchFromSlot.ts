import * as z from "zod/v4";
import yaml from "yaml";
import dayjs from "dayjs";
import { TextContent } from "@modelcontextprotocol/server";

import {
    API_BASE_URL,
    tokenContext,
    LOCAL_TIMEZONE,
    isoTimeStr,
} from "../utils/utils";

// Description détaillée du tool pour guider le LLM
const CREATE_MATCH_FROM_SLOT_DESC = `
Purpose:
Creates a new Padel match from an available time slot.

Guidelines:
- When to use: Use this tool ONLY when the user confirms they want to create a new match from a specific available slot they selected.

Limitations:
- Do not use this tool to join an already existing open match (use 'join-open-match' for that).
`;

// Schéma de validation des données d'entrée du tool
export const createMatchFromSlotInputSchema = z.object({
    courtId: z.number().int().min(1).describe("ID of the court for the slot."),
    startTime: isoTimeStr,
    endTime: isoTimeStr,
});

// Interface pour typer la réponse brute de l'API REST
interface ApiCreateMatchResponse {
    message: string;
    match?: {
        id: number;
        availableSpots: number;
    };
}

// Définition du tool
export const createMatchFromSlotTool = {
    name: "create-match-from-slot",
    config: {
        title: "Create match from slot",
        description: CREATE_MATCH_FROM_SLOT_DESC,
        inputSchema: createMatchFromSlotInputSchema,
    },
    handler: async (
        rawInput: z.infer<typeof createMatchFromSlotInputSchema>,
    ) => {
        try {
            const { courtId, startTime, endTime } =
                createMatchFromSlotInputSchema.parse(rawInput);

            console.log(
                `Input reçu pour createMatchFromSlotTool : courtId=${courtId}, startTime=${startTime}, endTime=${endTime}`,
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

            // Conversion de l'heure locale (demandée par le LLM) vers UTC pour l'API
            const utcStartTime = dayjs
                .tz(startTime, LOCAL_TIMEZONE)
                .utc()
                .format();
            const utcEndTime = dayjs.tz(endTime, LOCAL_TIMEZONE).utc().format();

            const url = `${API_BASE_URL}/matches/from-slot`;
            console.log("URL de l'API pour créer un match :", url);

            const res = await fetch(url, {
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

            const payload = (await res.json()) as
                | ApiCreateMatchResponse
                | { message: string };

            if (!res.ok) {
                const errorMessage =
                    "message" in payload
                        ? payload.message
                        : `Create match failed (${res.status} ${res.statusText})`;

                return {
                    isError: true,
                    content: [
                        { type: "text", text: errorMessage } as TextContent,
                    ],
                };
            }

            const responseData = payload as ApiCreateMatchResponse;

            // Format minimaliste et clair pour le LLM
            const optimizedOutput = {
                status: "Success",
                message: responseData.message,
                matchId: responseData.match?.id,
                availableSpots: responseData.match?.availableSpots,
            };

            return {
                content: [
                    {
                        type: "text",
                        text: yaml.stringify(optimizedOutput),
                    } as TextContent,
                ],
            };
        } catch (error) {
            const message =
                error instanceof Error
                    ? `Unable to create match from slot: ${error.message}`
                    : "Unable to create match from slot";

            return {
                isError: true,
                content: [{ type: "text", text: message } as TextContent],
            };
        }
    },
};
