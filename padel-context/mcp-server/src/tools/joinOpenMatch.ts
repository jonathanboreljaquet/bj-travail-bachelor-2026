import * as z from "zod/v4";
import yaml from "yaml";
import { TextContent } from "@modelcontextprotocol/server";

import { API_BASE_URL, tokenContext } from "../utils/utils";

// Description détaillée du tool pour le LLM
const JOIN_OPEN_MATCH_DESC = `
Purpose:
Registers the current user into an existing open Padel match. It returns a success message and the updated number of remaining spots.

Guidelines:
- When to use: Use this tool ONLY when the user explicitly confirms they want to join a specific match they previously selected.
- You should follow these CRITICAL rules:
  1. The 'matchId' must be retrieved accurately from a previous call to 'get-open-matches'.
  2. Upon success, inform the user that they are registered and announce how many spots are still open for that match.

Limitations:
- Do NOT use this tool to create a new match from a blank slot (use 'create-match-from-slot' for that).
- This tool requires an authenticated user context (JWT token).

Parameter Explanation:
- matchId (integer, required): The unique identifier of the existing match the user wants to join.

Examples:
- User: "I want to join the match with ID 45." -> Assistant calls tool with matchId=45.
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
