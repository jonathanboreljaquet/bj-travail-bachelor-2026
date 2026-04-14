import { Router } from "express";
import { getAvailableSlots } from "../controllers/available_slot.controller";

const router = Router();

/**
 * @swagger
 * /api/available-slots:
 *   get:
 *     summary: Récupérer les créneaux disponibles à l'aide de filtres
 *     description: |
 *       Retourne les créneaux disponibles pour chaque terrain correspondant aux filtres.
 *       
 *       Sans l'utilisation de `timeFrom` et `timeTo`, retourne les créneaux pour les 7 prochains jours.
 *
 *       Les créneaux déjà occupés par des matchs ouverts et complétés sont exclus.
 *       Les matchs annulés ne bloquent pas un créneau.
 *
 *       Les filtres query sont optionnels et combinables.
 *     tags:
 *       - Available Slots
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
 *         example: COVERED
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
 *         example: 25
 *       - in: query
 *         name: slotDuration
 *         required: false
 *         schema:
 *           type: integer
 *         description: Durée exacte du créneau en minutes.
 *         example: 60
 *       - in: query
 *         name: minSlotDuration
 *         required: false
 *         schema:
 *           type: integer
 *         description: Durée minimale du créneau en minutes (incluse).
 *         example: 45
 *       - in: query
 *         name: maxSlotDuration
 *         required: false
 *         schema:
 *           type: integer
 *         description: Durée maximale du créneau en minutes (incluse).
 *         example: 120
 *       - in: query
 *         name: timeFrom
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Début de la fenêtre de disponibilité à retourner.
 *         example: 2026-04-15T08:00:00.000Z
 *       - in: query
 *         name: timeTo
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fin de la fenêtre de disponibilité à retourner.
 *         example: 2026-04-15T20:00:00.000Z
 *     responses:
 *       400:
 *         description: Fenêtre invalide (`timeTo <= timeFrom`).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: timeTo must be greater than timeFrom
 *       200:
 *         description: Liste des terrains avec leurs créneaux disponibles.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   court:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 11
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
 *                         example: 60
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
 *                             example: 22:00
 *                   availableSlots:
 *                     type: array
 *                     description: Créneaux libres, alignés sur la grille du terrain.
 *                     items:
 *                       type: object
 *                       properties:
 *                         startTime:
 *                           type: string
 *                           format: date-time
 *                           example: 2026-04-15T09:00:00.000Z
 *                         endTime:
 *                           type: string
 *                           format: date-time
 *                           example: 2026-04-15T10:00:00.000Z
 *             examples:
 *               slots_found:
 *                 summary: Exemple avec des créneaux disponibles
 *                 value:
 *                   - court:
 *                       id: 11
 *                       name: Court Alpha
 *                       type: INDOOR
 *                       hasEquipmentBox: true
 *                       pricePerPerson: 18
 *                       slotDuration: 60
 *                       club:
 *                         name: Geneva Club
 *                         city: Lancy
 *                         openingTime: "08:00"
 *                         closingTime: "10:00"
 *                     availableSlots:
 *                       - startTime: 2026-04-15T09:00:00.000Z
 *                         endTime: 2026-04-15T10:00:00.000Z
 *               no_matching_courts_or_slots:
 *                 summary: Aucun terrain ou créneau disponible
 *                 value: []
 *       500:
 *         description: Erreur interne lors de la récupération des créneaux disponibles.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error while fetching available slots
 */
router.get("/", getAvailableSlots);
export default router;
