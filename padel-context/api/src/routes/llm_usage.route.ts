import { Router } from "express";
import { authenticateJwt } from "../middlewares/auth.middleware";
import { getLlmUsage, logLlmUsage } from "../controllers/llm_usage.controller";

const router = Router();

/**
 * @swagger
 * /api/llm-usage/me:
 *   get:
 *     summary: Récupérer l'usage LLM mensuel de l'utilisateur connecté
 *     description: Retourne le nombre de tokens consommés ce mois et la limite mensuelle de l'utilisateur.
 *     tags:
 *       - LLM Usage
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usage LLM actuel récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentMonthTokens:
 *                   type: integer
 *                   description: Nombre de tokens consommés ce mois
 *                   example: 45234
 *                 monthlyTokenLimit:
 *                   type: integer
 *                   description: Limite mensuelle de tokens
 *                   example: 500000
 *       401:
 *         description: Authentification échouée (token manquant ou invalide).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "missing or invalid authorization header"
 *       404:
 *         description: Utilisateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "user not found"
 *       500:
 *         description: Erreur serveur interne
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error while fetching LLM usage"
 */
router.get("/me", authenticateJwt, getLlmUsage);

/**
 * @swagger
 * /api/llm-usage/log:
 *   post:
 *     summary: Enregistrer l'usage LLM et incrémenter les tokens mensuels
 *     description: Crée un nouveau log et incrémente les tokens consommés du mois pour l'utilisateur.
 *     tags:
 *       - LLM Usage
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       description: Données d'usage LLM à enregistrer
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *               - inputTokens
 *               - outputTokens
 *               - totalTokens
 *               - model
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: La question ou requête de l'utilisateur
 *                 example: "Je souhaite rejoindre un match le 28 avril 2026 sur un terrain couvert à Lancy"
 *               inputTokens:
 *                 type: integer
 *                 description: Nombre de tokens en entrée (prompt)
 *                 example: 25
 *               outputTokens:
 *                 type: integer
 *                 description: Nombre de tokens en sortie (réponse)
 *                 example: 150
 *               totalTokens:
 *                 type: integer
 *                 description: Total des tokens consommés (inputTokens + outputTokens)
 *                 example: 175
 *               model:
 *                 type: string
 *                 description: Identifiant du modèle LLM utilisé
 *                 example: "gemini-3.1-flash-lite"
 *     responses:
 *       201:
 *         description: Usage LLM enregistré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "usage logged"
 *                 logId:
 *                   type: integer
 *                   description: ID unique de l'entrée d'usage enregistrée
 *                   example: 42
 *                 currentMonthTokens:
 *                   type: integer
 *                   description: Nombre total de tokens consommés ce mois après enregistrement
 *                   example: 45409
 *                 monthlyTokenLimit:
 *                   type: integer
 *                   description: Limite mensuelle de tokens
 *                   example: 500000
 *       400:
 *         description: Erreur de validation - Payload invalide ou champs manquants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               missing_prompt:
 *                 summary: Prompt manquant ou vide
 *                 value:
 *                   message: "prompt is required"
 *               missing_model:
 *                 summary: Model manquant ou vide
 *                 value:
 *                   message: "model is required"
 *               invalid_tokens:
 *                 summary: Tokens invalides ou négatifs
 *                 value:
 *                   message: "invalid token usage payload"
 *               mismatch_total_tokens:
 *                 summary: totalTokens ne correspond pas à la somme inputTokens + outputTokens
 *                 value:
 *                   message: "totalTokens must equal inputTokens + outputTokens"
 *       401:
 *         description: Authentification échouée (token manquant ou invalide).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "missing or invalid authorization header"
 *       404:
 *         description: Utilisateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "user not found"
 *       500:
 *         description: Erreur serveur interne
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error while logging LLM usage"
 *                 error:
 *                   type: string
 *                   description: Détail de l'erreur
 */
router.post("/log", authenticateJwt, logLlmUsage);

export default router;
