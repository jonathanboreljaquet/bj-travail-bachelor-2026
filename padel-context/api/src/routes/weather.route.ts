import { Router } from "express";
import { getWeather } from "../controllers/weather.controller";

const router = Router();

/**
 * @swagger
 * /api/weather:
 *   get:
 *     summary: Récupérer les données météo pour un code postal et une date
 *     description: |
 *       Retourne les données météo (précipitations, vent, température) pour un code postal suisse et une date/heure en ISO 8601.
 *
 *       La date/heure est automatiquement arrondie à l'heure pleine.
 *
 *       Par exemple : 2026-05-12T17:45:30.000Z devient 202605121700.
 *
 *     tags:
 *       - Weather
 *     parameters:
 *       - in: query
 *         name: postalCode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}$'
 *         description: Code postal suisse (exactement 4 chiffres)
 *         example: "1202"
 *       - in: query
 *         name: datetime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Date et heure au format ISO 8601 (UTC)
 *         example: "2026-05-12T17:27:00.000Z"
 *     responses:
 *       200:
 *         description: Données météo récupérées avec succès (les valeurs peuvent être null si pas de données)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 postalCode:
 *                   type: string
 *                   example: "1202"
 *                 datetime:
 *                   type: string
 *                   description: Datetime arrondi à l'heure pleine (format YYYYMMDDHHmm)
 *                   example: "202605121700"
 *                 precipitation:
 *                   type: number
 *                   nullable: true
 *                   description: Précipitations en mm
 *                 wind:
 *                   type: number
 *                   nullable: true
 *                   description: Vitesse du vent en km/h
 *                 temperature:
 *                   type: number
 *                   nullable: true
 *                   description: Température en °C
 *             examples:
 *               with_data:
 *                 summary: Avec données météo
 *                 value:
 *                   postalCode: "1202"
 *                   datetime: "202605121700"
 *                   precipitation: 0.2
 *                   wind: 9.2
 *                   temperature: 18.5
 *               without_data:
 *                 summary: Sans données météo
 *                 value:
 *                   postalCode: "1202"
 *                   datetime: "202605121700"
 *                   precipitation: null
 *                   wind: null
 *                   temperature: null
 *       400:
 *         description: Paramètres invalides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               invalid_postal:
 *                 summary: Code postal invalide
 *                 value:
 *                   message: "postalCode must be exactly 4 digits"
 *               missing_datetime:
 *                 summary: Date manquante ou invalide
 *                 value:
 *                   message: "datetime is required"
 *       404:
 *         description: Code postal non trouvé dans la base de données
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No point_id found for postal code: 9999"
 *       500:
 *         description: Erreur interne du serveur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error while fetching weather"
 */
router.get("/", getWeather);

export default router;
