import { Router } from "express";
import { getMatches, joinMatch } from "../controllers/match.controller";
import { createMatchFromSlot } from "../controllers/available_slot.controller";
import { authenticateJwt } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @swagger
 * /api/matches:
 *   get:
 *     summary: Récupérer les matchs ouverts à l'aide de filtres
 *     description: |
 *       Retourne uniquement les matchs ouverts à venir, soit un match avec au moins une place disponible.
 *
 *       Les filtres query sont optionnels et combinables.
 *     tags:
 *       - Matches
 *     parameters:
 *       - in: query
 *         name: city
 *         required: false
 *         schema:
 *           type: string
 *         description: Ville du club.
 *         example: Lancy
 *       - in: query
 *         name: courtType
 *         required: false
 *         schema:
 *           type: string
 *           enum: [INDOOR, OUTDOOR, COVERED]
 *         description: |
 *           Type de terrain. La valeur est normalisée en majuscules.
 *           Une valeur hors enum est ignorée.
 *         example: INDOOR
 *       - in: query
 *         name: hasEquipmentBox
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Filtrer selon la présence d'une box d'équipement.
 *         example: true
 *       - in: query
 *         name: minPricePerPerson
 *         required: false
 *         schema:
 *           type: number
 *         description: Prix minimum par personne (inclus).
 *         example: 10
 *       - in: query
 *         name: maxPricePerPerson
 *         required: false
 *         schema:
 *           type: number
 *         description: Prix maximum par personne (inclus).
 *         example: 20
 *       - in: query
 *         name: slotDuration
 *         required: false
 *         schema:
 *           type: integer
 *         description: Durée exacte du créneau en minutes.
 *         example: 120
 *       - in: query
 *         name: minSlotDuration
 *         required: false
 *         schema:
 *           type: integer
 *         description: Durée minimale du créneau en minutes (incluse).
 *         example: 90
 *       - in: query
 *         name: maxSlotDuration
 *         required: false
 *         schema:
 *           type: integer
 *         description: Durée maximale du créneau en minutes (incluse).
 *         example: 120
 *       - in: query
 *         name: availableSpots
 *         required: false
 *         schema:
 *           type: integer
 *         description: Nombre exact de places disponibles.
 *         example: 2
 *       - in: query
 *         name: minAvailableSpots
 *         required: false
 *         schema:
 *           type: integer
 *         description: Nombre minimal de places disponibles (inclus).
 *         example: 1
 *       - in: query
 *         name: startTimeFrom
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: |
 *           Date/heure minimale de début. Si la valeur est dans le passé,
 *           la borne utilisée reste la date actuelle.
 *         example: 2026-04-15T18:00:00.000Z
 *       - in: query
 *         name: startTimeTo
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Date/heure maximale de début (incluse).
 *         example: 2026-04-16T20:00:00.000Z
 *       - in: query
 *         name: endTimeFrom
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Date/heure minimale de fin (incluse).
 *         example: 2026-04-15T19:00:00.000Z
 *       - in: query
 *         name: endTimeTo
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Date/heure maximale de fin (incluse).
 *         example: 2026-04-15T21:00:00.000Z
 *       - in: query
 *         name: participantAverageLevel
 *         required: false
 *         schema:
 *           type: number
 *         description: |
 *           Niveau moyen cible des participants déjà inscrits.
 *         example: 5
 *       - in: query
 *         name: participantAverageLevelTolerance
 *         required: false
 *         schema:
 *           type: number
 *           default: 0.5
 *         description: Tolérance absolue autour de `participantAverageLevel`.
 *         example: 0.1
 *     responses:
 *       200:
 *         description: Liste des matchs correspondant aux filtres.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 101
 *                   startTime:
 *                     type: string
 *                     format: date-time
 *                     example: 2026-04-15T18:00:00.000Z
 *                   endTime:
 *                     type: string
 *                     format: date-time
 *                     example: 2026-04-15T20:00:00.000Z
 *                   status:
 *                     type: string
 *                     example: OPEN
 *                   availableSpots:
 *                     type: integer
 *                     example: 2
 *                   court:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: Court Alpha
 *                       type:
 *                         type: string
 *                         example: INDOOR
 *                       hasEquipmentBox:
 *                         type: boolean
 *                         example: true
 *                       pricePerPerson:
 *                         type: number
 *                         example: 18
 *                       slotDuration:
 *                         type: integer
 *                         example: 120
 *                       club:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Geneva Club
 *                           city:
 *                             type: string
 *                             example: Lancy
 *                           openingTime:
 *                             type: string
 *                             example: 08:00
 *                           closingTime:
 *                             type: string
 *                             example: 23:00
 *                   participants:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         user:
 *                           type: object
 *                           properties:
 *                             firstname:
 *                               type: string
 *                               example: Ana
 *                             lastname:
 *                               type: string
 *                               example: Martinez
 *                             email:
 *                               type: string
 *                               format: email
 *                               example: ana@test.dev
 *                             level:
 *                               type: integer
 *                               example: 2
 *       500:
 *         description: Erreur interne lors de la récupération des matchs.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error while fetching matches
 */
router.get("/", getMatches);
router.post("/from-slot", authenticateJwt, createMatchFromSlot);
router.post("/:matchId/join", authenticateJwt, joinMatch);

export default router;
