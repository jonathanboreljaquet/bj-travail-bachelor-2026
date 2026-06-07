import * as z from "zod/v4";
import yaml from "yaml";
import { TextContent } from "@modelcontextprotocol/server";

import { API_BASE_URL, tokenContext } from "../utils/utils";

// Description détaillée du tool pour le LLM
const JOIN_OPEN_MATCH_DESC = `
Purpose:
Joins an existing open Padel match.

Guidelines:
- When to use: Use this tool ONLY when the user explicitly confirms they want to join a specific Padel match.

Limitations:
- Do not use this tool to create a new match from an available slot (use 'create-match-from-slot' for that).
`;

// Schémas de validation des données d'entrée du tools
export const joinOpenMatchInputSchema = z.object({
    matchId: z
        .number()
        .int()
        .describe(
            "ID of the match to join. MUST be extracted from the 'get-open-matches' tool results.",
        ),
});

// Interface pour typer la réponse brute de l'API REST
interface ApiJoinedMatchResponse {
    message: string;
    match?: {
        availableSpots: number;
    };
}

// Définition du tool
export const joinOpenMatchTool = {
    name: "join-open-match",
    config: {
        title: "Join open match",
        description: JOIN_OPEN_MATCH_DESC,
        inputSchema: joinOpenMatchInputSchema,
    },
    handler: async (rawInput: z.infer<typeof joinOpenMatchInputSchema>) => {
        try {
            const { matchId } = joinOpenMatchInputSchema.parse(rawInput);

            console.log(
                `Input reçu pour joinOpenMatchTool : matchId=${matchId}`,
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

            const url = `${API_BASE_URL}/matches/${matchId}/join`;
            console.log("URL de l'API pour rejoindre un match :", url);

            const res = await fetch(url, {
                method: "POST",
                headers: { Authorization: `Bearer ${jwtToken}` },
            });

            const payload = (await res.json()) as
                | ApiJoinedMatchResponse
                | { message: string };

            if (!res.ok) {
                const errorMessage =
                    "message" in payload
                        ? payload.message
                        : `Join match failed (${res.status} ${res.statusText})`;

                return {
                    isError: true,
                    content: [
                        { type: "text", text: errorMessage } as TextContent,
                    ],
                };
            }

            const responseData = payload as ApiJoinedMatchResponse;

            const optimizedOutput = {
                message: responseData.message,
                remainingSpots: responseData.match?.availableSpots,
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
                    ? `Unable to join match: ${error.message}`
                    : "Unable to join match";

            return {
                isError: true,
                content: [{ type: "text", text: message } as TextContent],
            };
        }
    },
};
