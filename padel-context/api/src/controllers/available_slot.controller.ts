import { Request, Response } from "express";
import prisma from "../db";
import { Prisma } from "../../generated/prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import {
    parseBoolean,
    parseDate,
    parseNumber,
    toMinutes,
    normalizeString,
    MAX_UPCOMING_MATCHES,
    MAX_UPCOMING_MATCHES_MESSAGE,
} from "../utils/helper";

dayjs.extend(utc);
dayjs.extend(timezone);
const LOCAL_TIMEZONE = "Europe/Zurich";

/**
 * Recherche et génère dynamiquement les créneaux horaires disponibles pour créer un match.
 * @param {Request} req - L'objet requête d'Express.
 * @param {string} [req.query.city] - (Optionnel) Filtre par ville du club (insensible à la casse).
 * @param {string} [req.query.hasEquipmentBox] - (Optionnel) Filtre sur la présence de matériel ("true" ou "false").
 * @param {number} [req.query.minPricePerPerson] - (Optionnel) Prix minimum par joueur.
 * @param {number} [req.query.maxPricePerPerson] - (Optionnel) Prix maximum par joueur.
 * @param {number} [req.query.slotDuration] - (Optionnel) Durée exacte du créneau souhaité en minutes.
 * @param {number} [req.query.minSlotDuration] - (Optionnel) Durée minimale du créneau en minutes.
 * @param {number} [req.query.maxSlotDuration] - (Optionnel) Durée maximale du créneau en minutes.
 * @param {string} [req.query.courtType] - (Optionnel) Type d'infrastructure ("INDOOR", "OUTDOOR" ou "COVERED").
 * @param {string} [req.query.timeFrom] - (Optionnel) Début de la fenêtre de recherche (format date/ISO). Par défaut : maintenant.
 * @param {string} [req.query.timeTo] - (Optionnel) Fin de la fenêtre de recherche (format date/ISO). Par défaut : J+7.
 * @param {number} [req.query.limit=20] - (Optionnel) Nombre maximum de créneaux générés par terrain. Par défaut : 20.
 * @param {Response} res - L'objet réponse d'Express.
 * @returns {200} Succès : Retourne un tableau de terrains (`court`) incluant pour chacun un sous-tableau `availableSlots`.
 * @throws {400} Mauvaise requête : Déclenché si la fenêtre de temps est invalide (`timeTo` <= `timeFrom`).
 * @throws {500} Erreur interne : Déclenché en cas de problème inattendu.
 */
export const getAvailableSlots = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const city =
            typeof req.query.city === "string"
                ? req.query.city.trim()
                : undefined;
        const hasEquipmentBox = parseBoolean(req.query.hasEquipmentBox);
        const minPricePerPerson = parseNumber(req.query.minPricePerPerson);
        const maxPricePerPerson = parseNumber(req.query.maxPricePerPerson);
        const slotDuration = parseNumber(req.query.slotDuration);
        const minSlotDuration = parseNumber(req.query.minSlotDuration);
        const maxSlotDuration = parseNumber(req.query.maxSlotDuration);
        const timeFrom = parseDate(req.query.timeFrom);
        const timeTo = parseDate(req.query.timeTo);
        const courtType =
            typeof req.query.courtType === "string"
                ? req.query.courtType.trim().toUpperCase()
                : undefined;
        const normalizedCourtType =
            courtType === "INDOOR" ||
            courtType === "OUTDOOR" ||
            courtType === "COVERED"
                ? courtType
                : undefined;

        // Par défaut, si l'utilisateur ne spécifie pas de dates, on cherche de maintenant jusqu'à dans 7 jours.
        const now = new Date();
        const windowStart = timeFrom ?? now;

        const windowEnd =
            timeTo ??
            new Date(
                Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate() + 7,
                ),
            );

        if (windowEnd <= windowStart) {
            res.status(400).json({
                message: "timeTo must be greater than timeFrom",
            });
            return;
        }

        const courtWhere: Prisma.CourtWhereInput = {};

        if (hasEquipmentBox !== undefined) {
            courtWhere.hasEquipmentBox = hasEquipmentBox;
        }

        if (
            minPricePerPerson !== undefined ||
            maxPricePerPerson !== undefined
        ) {
            courtWhere.pricePerPerson = {
                gte: minPricePerPerson,
                lte: maxPricePerPerson,
            };
        }

        if (
            slotDuration !== undefined ||
            minSlotDuration !== undefined ||
            maxSlotDuration !== undefined
        ) {
            courtWhere.slotDuration = {
                equals: slotDuration,
                gte: minSlotDuration,
                lte: maxSlotDuration,
            };
        }

        if (normalizedCourtType) {
            courtWhere.type = normalizedCourtType;
        }

        const courts = await prisma.court.findMany({
            where: courtWhere,
            select: {
                id: true,
                name: true,
                type: true,
                hasEquipmentBox: true,
                pricePerPerson: true,
                slotDuration: true,
                club: {
                    select: {
                        name: true,
                        city: true,
                        postalCode: true,
                        openingTime: true,
                        closingTime: true,
                    },
                },
            },
        });

        // Filtrage des villes normalisé pour éviter les problèmes d'accents, de majuscules, etc...
        const filteredCourts = city
            ? courts.filter(
                  (court) =>
                      normalizeString(court.club.city) ===
                      normalizeString(city),
              )
            : courts;

        if (filteredCourts.length === 0) {
            res.status(200).json([]);
            return;
        }

        const courtIds = filteredCourts.map((court) => court.id);

        const matchWhere: Prisma.MatchWhereInput = {
            court_id: {
                in: courtIds,
            },
            status: {
                in: ["OPEN", "COMPLETED"],
            },
            startTime: {
                lt: windowEnd,
            },
            endTime: {
                gt: windowStart,
            },
        };

        const matches = await prisma.match.findMany({
            where: matchWhere,
            select: {
                court_id: true,
                status: true,
                startTime: true,
                endTime: true,
            },
        });

        const byCourt = new Map<
            number,
            Array<{ startTime: Date; endTime: Date }>
        >();
        matches.forEach((match) => {
            if (match.status === "CANCELED") {
                return;
            }

            const current = byCourt.get(match.court_id) ?? [];
            current.push({
                startTime: new Date(match.startTime),
                endTime: new Date(match.endTime),
            });
            byCourt.set(match.court_id, current);
        });

        const windowStartMs = windowStart.getTime();
        const windowEndMs = windowEnd.getTime();

        const availableSlots = filteredCourts.map((court) => {
            const occupied = byCourt.get(court.id) ?? [];
            const slots: Array<{ startTime: string; endTime: string }> = [];

            // Extraction des heures et minutes d'ouverture/fermeture du club (ex: "07:00" -> 7 et 0)
            const [openH, openM] = court.club.openingTime
                .split(":")
                .map(Number);
            const [closeH, closeM] = court.club.closingTime
                .split(":")
                .map(Number);

            // Définition du premier jour à scanner en heure locale (Europe/Zurich)
            let currentDayLocal = dayjs(windowStart)
                .tz(LOCAL_TIMEZONE)
                .startOf("day");
            const lastDayLocal = dayjs(windowEnd)
                .tz(LOCAL_TIMEZONE)
                .startOf("day");

            // Boucle jour par jour jusqu'à atteindre la date de fin
            while (currentDayLocal.valueOf() <= lastDayLocal.valueOf()) {
                // Fixe l'heure d'ouverture et de fermeture sur la journée locale en cours
                let slotStartLocal = currentDayLocal.hour(openH).minute(openM);
                const clubCloseLocal = currentDayLocal
                    .hour(closeH)
                    .minute(closeM);

                // Génération de tous les créneaux de la journée (de 07:00 à 22:00 par exemple)
                while (
                    slotStartLocal
                        .add(court.slotDuration, "minute")
                        .valueOf() <= clubCloseLocal.valueOf()
                ) {
                    const slotEndLocal = slotStartLocal.add(
                        court.slotDuration,
                        "minute",
                    );

                    const slotStartMs = slotStartLocal.valueOf();
                    const slotEndMs = slotEndLocal.valueOf();

                    // Vérification pour voir si le créneau est strictement dans la fenêtre globale demandée
                    if (
                        slotStartMs >= windowStartMs &&
                        slotEndMs <= windowEndMs
                    ) {
                        // Vérification de chevauchement avec aucun match existant
                        const isOccupied = occupied.some(
                            (match) =>
                                slotStartMs < match.endTime.getTime() &&
                                slotEndMs > match.startTime.getTime(),
                        );

                        if (!isOccupied) {
                            slots.push({
                                startTime: slotStartLocal.utc().toISOString(),
                                endTime: slotEndLocal.utc().toISOString(),
                            });
                        }
                    }

                    slotStartLocal = slotEndLocal;
                }

                currentDayLocal = currentDayLocal.add(1, "day");
            }

            return {
                court,
                availableSlots: slots,
            };
        });

        res.status(200).json(availableSlots);
    } catch (error) {
        res.status(500).json({
            message: "Error while fetching available slots",
            error: error,
        });
    }
};

/**
 * Crée un nouveau match de Padel à partir d'un créneau disponible et y inscrit le créateur.
 * @param {Request} req - L'objet requête d'Express.
 * @param {number} req.body.courtId - (Requis) L'identifiant unique du terrain sélectionné.
 * @param {string} req.body.startTime - (Requis) Heure de début du créneau (format date/ISO).
 * @param {string} req.body.endTime - (Requis) Heure de fin du créneau (format date/ISO).
 * @param {Response} res - L'objet réponse d'Express.
 * @returns {201} Succès : Retourne l'objet `match` créé, incluant les infos du terrain, du club et des participants.
 * @throws {400} Mauvaise requête : Déclenché si les paramètres sont invalides, si le créneau est en dehors des horaires du club, ou si la durée ne correspond pas à la grille.
 * @throws {401} Non autorisé : Déclenché si l'utilisateur n'est pas authentifié.
 * @throws {403} Interdit : Déclenché si l'utilisateur a atteint sa limite maximale de matchs futurs.
 * @throws {404} Non trouvé : Déclenché si le terrain (`courtId`) n'existe pas en base.
 * @throws {409} Conflit : Déclenché si le créneau demandé chevauche un match déjà existant (double-booking).
 * @throws {500} Erreur interne : Déclenché en cas d'échec de la transaction ou de problème inattendu.
 */
export const createMatchFromSlot = async (
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

        const courtId = Number(req.body?.courtId);
        const startTime = parseDate(req.body?.startTime);
        const endTime = parseDate(req.body?.endTime);

        if (
            !Number.isInteger(courtId) ||
            courtId <= 0 ||
            !startTime ||
            !endTime
        ) {
            res.status(400).json({
                message: "courtId, startTime and endTime are required",
            });
            return;
        }

        if (startTime >= endTime) {
            res.status(400).json({ message: "invalid slot range" });
            return;
        }

        const upcomingMatchesCount = await prisma.participant.count({
            where: {
                user_id: authUser.userId,
                match: {
                    startTime: {
                        gte: new Date(),
                    },
                },
            },
        });

        if (upcomingMatchesCount >= MAX_UPCOMING_MATCHES) {
            res.status(403).json({ message: MAX_UPCOMING_MATCHES_MESSAGE });
            return;
        }

        const court = await prisma.court.findUnique({
            where: { id: courtId },
            select: {
                id: true,
                slotDuration: true,
                club: {
                    select: {
                        openingTime: true,
                        closingTime: true,
                    },
                },
            },
        });

        if (!court) {
            res.status(404).json({ message: "court not found" });
            return;
        }

        const slotDurationMinutes =
            (endTime.getTime() - startTime.getTime()) / (60 * 1000);

        if (slotDurationMinutes !== court.slotDuration) {
            res.status(400).json({
                message: "slot duration does not match court slotDuration",
            });
            return;
        }

        const openingMinutes = toMinutes(court.club.openingTime);
        const closingMinutes = toMinutes(court.club.closingTime);

        const localStartTime = dayjs(startTime).tz(LOCAL_TIMEZONE);
        const localEndTime = dayjs(endTime).tz(LOCAL_TIMEZONE);

        const startMinutesLocal =
            localStartTime.hour() * 60 + localStartTime.minute();
        const endMinutesLocal =
            localEndTime.hour() * 60 + localEndTime.minute();

        if (
            startMinutesLocal < openingMinutes ||
            endMinutesLocal > closingMinutes
        ) {
            res.status(400).json({
                message: "slot is outside club opening hours",
            });
            return;
        }

        if ((startMinutesLocal - openingMinutes) % court.slotDuration !== 0) {
            res.status(400).json({
                message: "slot is not aligned with court slotDuration",
            });
            return;
        }

        const now = new Date();

        const windowEnd = new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() + 7,
            ),
        );

        if (startTime < now || endTime > windowEnd) {
            res.status(400).json({
                message: "slot must be within the next 7 days",
            });
            return;
        }

        const overlappingMatch = await prisma.match.findFirst({
            where: {
                court_id: courtId,
                status: {
                    in: ["OPEN", "COMPLETED"],
                },
                startTime: {
                    lt: endTime,
                },
                endTime: {
                    gt: startTime,
                },
            },
            select: {
                id: true,
            },
        });

        if (overlappingMatch) {
            res.status(409).json({ message: "slot is no longer available" });
            return;
        }

        const match = await prisma.$transaction(async (tx) => {
            const createdMatch = await tx.match.create({
                data: {
                    startTime,
                    endTime,
                    status: "OPEN",
                    availableSpots: 3,
                    court_id: courtId,
                    creator_id: authUser.userId,
                },
                select: {
                    id: true,
                },
            });

            await tx.participant.create({
                data: {
                    user_id: authUser.userId,
                    match_id: createdMatch.id,
                },
            });

            return tx.match.findUnique({
                where: { id: createdMatch.id },
                select: {
                    id: true,
                    status: true,
                    availableSpots: true,
                    startTime: true,
                    endTime: true,
                    creator_id: true,
                    court: {
                        select: {
                            name: true,
                            type: true,
                            club: {
                                select: {
                                    name: true,
                                    city: true,
                                },
                            },
                        },
                    },
                    participants: {
                        select: {
                            user: {
                                select: {
                                    id: true,
                                    firstname: true,
                                    lastname: true,
                                    email: true,
                                    level: true,
                                },
                            },
                            joinedAt: true,
                        },
                    },
                },
            });
        });

        res.status(201).json({
            message: "match created from slot",
            match,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error while creating match from slot",
            error: error,
        });
    }
};
