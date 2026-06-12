import { Router } from "express";
import {
    getMatches,
    joinMatch,
    getMyMatches,
} from "../controllers/match.controller";
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
 *     security:
 *       - bearerAuth: []
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
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Nombre maximum de matchs retournés.
 *         example: 10
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
 *                               example: Jonathan
 *                             lastname:
 *                               type: string
 *                               example: Borel-Jaquet
 *                             email:
 *                               type: string
 *                               format: email
 *                               example: jonathan.borel@padelcontext.com
 *                             level:
 *                               type: integer
 *                               example: 2
 *       401:
 *         description: Authentification échouée (token manquant ou invalide).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: missing or invalid authorization header
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
router.get("/", authenticateJwt, getMatches);
/**
 * @swagger
 * /api/matches/me:
 *   get:
 *     summary: Récupérer tous les matchs de l'utilisateur connecté
 *     description: |
 *       Retourne l'ensemble des matchs auxquels l'utilisateur authentifié participe quel que soit leur statut (OPEN, COMPLETED, CANCELED).
 *
 *       Les résultats sont triés par date de début croissante.
 *     tags:
 *       - Matches
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des matchs de l'utilisateur.
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
 *                     enum: [OPEN, COMPLETED, CANCELED]
 *                     example: COMPLETED
 *                   availableSpots:
 *                     type: integer
 *                     example: 0
 *                   creator_id:
 *                     type: integer
 *                     example: 21
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
 *                           postalCode:
 *                             type: string
 *                             example: "1212"
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
 *                               example: Jonathan
 *                             level:
 *                               type: integer
 *                               example: 2
 *       401:
 *         description: Authentification échouée (token manquant ou invalide).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: missing or invalid authorization header
 *       500:
 *         description: Erreur interne lors de la récupération des matchs de l'utilisateur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error while fetching user matches
 */
router.get("/me", authenticateJwt, getMyMatches);
/**
 * @swagger
 * /api/matches/from-slot:
 *   post:
 *     summary: Créer un match depuis un créneau disponible
 *     description: Permet à un utilisateur authentifié de créer un match à partir d'un slot disponible, puis de s'y inscrire automatiquement. Avec une limite par défaut de 5 matchs futurs.
 *     tags:
 *       - Matches
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       description: Informations du créneau à transformer en match.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courtId
 *               - startTime
 *               - endTime
 *             properties:
 *               courtId:
 *                 type: integer
 *                 description: Identifiant du terrain concerné.
 *                 example: 12
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: Date/heure UTC de début du créneau.
 *                 example: 2026-04-15T18:00:00.000Z
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: Date/heure UTC de fin du créneau.
 *                 example: 2026-04-15T19:00:00.000Z
 *     responses:
 *       201:
 *         description: Match créé avec succès depuis le créneau.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: match created from slot
 *                 match:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 101
 *                     status:
 *                       type: string
 *                       example: OPEN
 *                     availableSpots:
 *                       type: integer
 *                       example: 3
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-04-15T18:00:00.000Z
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-04-15T19:00:00.000Z
 *                     creator_id:
 *                       type: integer
 *                       example: 12
 *                     court:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: Court Alpha
 *                         type:
 *                           type: string
 *                           example: INDOOR
 *                         club:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               example: Geneva Club
 *                             city:
 *                               type: string
 *                               example: Lancy
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 21
 *                               firstname:
 *                                 type: string
 *                                 example: Jonathan
 *                               lastname:
 *                                 type: string
 *                                 example: Borel-Jaquet
 *                               email:
 *                                 type: string
 *                                 format: email
 *                                 example: jonathan.borel@padelcontext.com
 *                               level:
 *                                 type: integer
 *                                 example: 2
 *                           joinedAt:
 *                             type: string
 *                             format: date-time
 *                             example: 2026-04-15T17:30:00.000Z
 *       400:
 *         description: Données invalides ou créneau non conforme aux règles métier.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               missing_fields:
 *                 summary: Paramètres requis manquants
 *                 value:
 *                   message: courtId, startTime and endTime are required
 *               invalid_range:
 *                 summary: Intervalle invalide
 *                 value:
 *                   message: invalid slot range
 *               invalid_duration:
 *                 summary: Durée non conforme au terrain
 *                 value:
 *                   message: slot duration does not match court slotDuration
 *               outside_opening_hours:
 *                 summary: Hors heures d'ouverture
 *                 value:
 *                   message: slot is outside club opening hours
 *               misaligned_slot:
 *                 summary: Créneau non aligné
 *                 value:
 *                   message: slot is not aligned with court slotDuration
 *               outside_7_days_window:
 *                 summary: Hors fenêtre de 7 jours
 *                 value:
 *                   message: slot must be within the next 7 days
 *       403:
 *         description: Limite de matchs futurs atteinte.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: You cannot participate in more than 5 upcoming matches at the same time
 *       401:
 *         description: Authentification échouée (token manquant ou invalide).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: missing or invalid authorization header
 *       404:
 *         description: Terrain introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: court not found
 *       409:
 *         description: Le créneau n'est plus disponible.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: slot is no longer available
 *       500:
 *         description: Erreur interne lors de la création du match depuis le créneau.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error while creating match from slot
 */
router.post("/from-slot", authenticateJwt, createMatchFromSlot);
/**
 * @swagger
 * /api/matches/{matchId}/join:
 *   post:
 *     summary: Rejoindre un match ouvert
 *     description: Permet à un utilisateur authentifié de rejoindre un match ouvert s'il reste des places disponibles. Avec une limite par défaut de 5 matchs futurs.
 *     tags:
 *       - Matches
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identifiant du match à rejoindre.
 *         example: 101
 *     responses:
 *       200:
 *         description: Match rejoint avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: successfully joined match
 *                 match:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 101
 *                     status:
 *                       type: string
 *                       example: OPEN
 *                     availableSpots:
 *                       type: integer
 *                       example: 1
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-04-15T18:00:00.000Z
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-04-15T20:00:00.000Z
 *                     creator_id:
 *                       type: integer
 *                       example: 12
 *                     court:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: Court Alpha
 *                         type:
 *                           type: string
 *                           example: INDOOR
 *                         club:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               example: Geneva Club
 *                             city:
 *                               type: string
 *                               example: Lancy
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 21
 *                               firstname:
 *                                 type: string
 *                                 example: Jonathan
 *                               lastname:
 *                                 type: string
 *                                 example: Borel-Jaquet
 *                               email:
 *                                 type: string
 *                                 format: email
 *                                 example: jonathan.borel@padelcontext.com
 *                               level:
 *                                 type: integer
 *                                 example: 2
 *                           joinedAt:
 *                             type: string
 *                             format: date-time
 *                             example: 2026-04-15T17:30:00.000Z
 *       400:
 *         description: Identifiant de match invalide, match fermé, plus de place indisponible ou utilisateur déjà inscrit.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               invalid_match_id:
 *                 summary: Identifiant invalide
 *                 value:
 *                   message: invalid match ID
 *               not_open:
 *                 summary: Match fermé
 *                 value:
 *                   message: match is not open
 *               no_spots:
 *                 summary: Plus de place disponible
 *                 value:
 *                   message: no available spots
 *               already_joined:
 *                 summary: Joueur déjà inscrit
 *                 value:
 *                   message: user already joined this match
 *       403:
 *         description: Limite de matchs futurs atteinte.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: You cannot participate in more than 5 upcoming matches at the same time
 *       401:
 *         description: Authentification échouée (token manquant ou invalide).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: missing or invalid authorization header
 *       404:
 *         description: Match introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: match not found
 *       500:
 *         description: Erreur interne lors de la participation au match.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error while joining match
 */
router.post("/:matchId/join", authenticateJwt, joinMatch);

export default router;
