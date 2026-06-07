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
Creates and registers a new Padel match using an available time slot on a specific court. It returns the creation status, the new match ID, and the number of available spots remaining.

Guidelines:
- When to use: Use this tool ONLY when the user explicitly confirms they want to book/create a new match from a specific time slot they previously selected via the 'get-available-slots' tool.
- You should follow these CRITICAL rules:
  1. Ensure you have the exact 'courtId', 'startTime', and 'endTime' from the user's prior selection. Do NOT invent or guess these values.
  2. After a successful creation, confirm to the user by providing the new match ID and telling them how many spots are left for others to join.
  3. ERROR RECOVERY: If the tool returns an error (e.g., slot is no longer available), apologize to the user and proactively suggest searching for new available slots.

Limitations:
- Do NOT use this tool to join an ALREADY EXISTING open match (use 'join-open-match' for that).
- This tool REQUIRES prior knowledge of available slots. Never call this blindly without having offered choices to the user first.

Examples:
- User: "Yes, let's book the 10:00 AM slot on Court 1." -> Assistant calls tool with courtId=1, startTime="[YYYY-MM-DDT10:00:00Z]", endTime="[YYYY-MM-DDT11:30:00Z]".
`;

// Schéma de validation des données d'entrée du tool
export const createMatchFromSlotInputSchema = z.object({
    courtId: z
        .number()
        .int()
        .min(1)
        .describe(
            "MANDATORY: The exact unique identifier of the selected court. This MUST be extracted directly from the results of a prior 'get-available-slots' search. Do not invent this ID.",
        ),
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
