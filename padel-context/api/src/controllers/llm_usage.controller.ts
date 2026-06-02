import { Request, Response } from "express";
import prisma from "../db";
import { parseTokenValue } from "../utils/helper";

/**
 * Récupère la consommation actuelle de tokens LLM de l'utilisateur authentifié.
 * @param {Request} req - L'objet requête d'Express.
 * @param {Response} res - L'objet réponse d'Express.
 * @returns {200} Succès : Retourne les tokens consommés ce mois-ci et la limite mensuelle.
 * @throws {401} Non autorisé : L'utilisateur n'est pas connecté.
 * @throws {404} Non trouvé : L'utilisateur n'existe pas en base de données.
 * @throws {500} Erreur interne : Problème lors de la communication avec la base de données.
 */
export const getLlmUsage = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const authUser = res.locals.authUser as
            | { userId: number; email: string }
            | undefined;

        if (!authUser) {
            res.status(401).json({ message: "unauthorized" });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: authUser.userId },
            select: {
                id: true,
                currentMonthTokens: true,
                monthlyTokenLimit: true,
            },
        });

        if (!user) {
            res.status(404).json({ message: "user not found" });
            return;
        }

        res.status(200).json({
            currentMonthTokens: user.currentMonthTokens,
            monthlyTokenLimit: user.monthlyTokenLimit,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error while fetching LLM usage",
            error: error,
        });
    }
};

/**
 * Enregistre un nouvel appel LLM et met à jour la consommation mensuelle de l'utilisateur.
 * @param {Request} req - L'objet requête d'Express.
 * @param {string} req.body.prompt - (Requis) Le prompt de la requête envoyée au LLM.
 * @param {number|string} req.body.inputTokens - (Requis) Le nombre de tokens consommés en entrée (Input Token).
 * @param {number|string} req.body.outputTokens - (Requis) Le nombre de tokens consommés en sortie (Output Token).
 * @param {number|string} req.body.totalTokens - (Requis) La somme exacte des tokens (Input + Output).
 * @param {string} req.body.model - (Requis) Le nom du modèle LLM utilisé.
 * @param {Response} res - L'objet réponse d'Express.
 * @returns {201} Créé : Retourne l'ID du log et le nouveau solde de tokens de l'utilisateur.
 * @throws {400} Mauvaise requête : Paramètres manquants, invalides ou incohérence mathématique dans les tokens.
 * @throws {401} Non autorisé : L'utilisateur n'est pas connecté.
 * @throws {404} Non trouvé : L'utilisateur n'existe pas en base de données.
 * @throws {500} Erreur interne : Échec de la transaction en base de données.
 */
export const logLlmUsage = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const authUser = res.locals.authUser as
            | { userId: number; email: string }
            | undefined;

        if (!authUser) {
            res.status(401).json({ message: "unauthorized" });
            return;
        }

        if (!req.body || typeof req.body !== "object") {
            res.status(400).json({ message: "invalid request body" });
            return;
        }

        const { prompt, inputTokens, outputTokens, totalTokens, model } =
            req.body as {
                prompt?: unknown;
                inputTokens?: unknown;
                outputTokens?: unknown;
                totalTokens?: unknown;
                model?: unknown;
            };

        if (typeof prompt !== "string" || !prompt.trim()) {
            res.status(400).json({ message: "prompt is required" });
            return;
        }

        if (typeof model !== "string" || !model.trim()) {
            res.status(400).json({ message: "model is required" });
            return;
        }

        const parsedInputTokens = parseTokenValue(inputTokens);
        const parsedOutputTokens = parseTokenValue(outputTokens);
        const parsedTotalTokens = parseTokenValue(totalTokens);

        if (
            parsedInputTokens === undefined ||
            parsedOutputTokens === undefined ||
            parsedTotalTokens === undefined
        ) {
            res.status(400).json({ message: "invalid token usage payload" });
            return;
        }

        const calculatedTotalTokens = parsedInputTokens + parsedOutputTokens;
        if (parsedTotalTokens !== calculatedTotalTokens) {
            res.status(400).json({
                message: "totalTokens must equal inputTokens + outputTokens",
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: authUser.userId },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ message: "user not found" });
            return;
        }

        const [usageLog, updatedUser] = await prisma.$transaction([
            prisma.llmUsageLog.create({
                data: {
                    user_id: authUser.userId,
                    prompt: prompt.trim(),
                    inputTokens: parsedInputTokens,
                    outputTokens: parsedOutputTokens,
                    totalTokens: parsedTotalTokens,
                    model: model.trim(),
                },
            }),
            prisma.user.update({
                where: { id: authUser.userId },
                data: {
                    currentMonthTokens: {
                        increment: parsedTotalTokens,
                    },
                },
                select: {
                    currentMonthTokens: true,
                    monthlyTokenLimit: true,
                },
            }),
        ]);

        res.status(201).json({
            message: "usage logged",
            logId: usageLog.id,
            currentMonthTokens: updatedUser.currentMonthTokens,
            monthlyTokenLimit: updatedUser.monthlyTokenLimit,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error while logging LLM usage",
            error: error,
        });
    }
};
