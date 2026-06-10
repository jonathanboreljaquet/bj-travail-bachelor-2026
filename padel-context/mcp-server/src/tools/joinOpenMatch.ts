import * as z from "zod/v4";
import yaml from "yaml";
import { TextContent } from "@modelcontextprotocol/server";

import { API_BASE_URL, tokenContext } from "../utils/utils";

// Description détaillée du tool pour le LLM
const JOIN_OPEN_MATCH_DESC = `
Purpose:
Registers the current user into an existing open Padel match.

Guidelines:
- When to use: Use this tool ONLY when the user explicitly confirms they want to join a specific match they previously selected via the 'get-open-matches' tool.
- The 'matchId' must be retrieved accurately from a previous call to 'get-open-matches'. Do not guess or invent it.

Limitations:
- Do NOT use this tool to create a new match from a blank slot (use 'create-match-from-slot' for that).
`;

// Schémas de validation des données d'entrée du tools
export const joinOpenMatchInputSchema = z.object({
    matchId: z
        .number()
        .int()
        .describe(
            "MANDATORY: The unique identifier of the existing match the user wants to join. This MUST be extracted directly from the results of a prior 'get-open-matches' search. Do not invent or guess this ID.",
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
