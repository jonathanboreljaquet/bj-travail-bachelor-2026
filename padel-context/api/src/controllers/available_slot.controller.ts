import { Request, Response } from "express";
import prisma from "../db";
import { Prisma } from "../../generated/prisma/client";
import {
    parseBoolean,
    parseDate,
    parseNumber,
    toDateAtMinutes,
    toMinutes,
    normalizeString,
    MAX_UPCOMING_MATCHES,
    MAX_UPCOMING_MATCHES_MESSAGE,
} from "../utils/helper";

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

        // Pour chaque terrain, on génère les créneaux disponibles en excluant les plages horaires occupées par les matchs existants.
        const availableSlots = filteredCourts.map((court) => {
            // Récupère les horaires du club en minutes depuis minuit (ex: 08:00 = 480, 22:00 = 1320)
            const openingMinutes = toMinutes(court.club.openingTime);
            const closingMinutes = toMinutes(court.club.closingTime);

            // Récupère tous les matchs déjà réservés pour ce terrain précis
            const occupied = byCourt.get(court.id) ?? [];

            const slots: Array<{ startTime: string; endTime: string }> = [];

            // Calcul l'heure minimum du premier jour de notre recherche
            const rangeDayStart = new Date(windowStart);
            rangeDayStart.setUTCHours(0, 0, 0, 0);

            // Boucle jour par jour sur la période demandée
            for (
                let currentDayStart = new Date(rangeDayStart);
                currentDayStart < windowEnd;
                currentDayStart.setUTCDate(currentDayStart.getUTCDate() + 1)
            ) {
                const currentDayEnd = new Date(currentDayStart);
                currentDayEnd.setUTCDate(currentDayEnd.getUTCDate() + 1);

                // Calcul currentMinutes selon l'heure actuelle si c'est aujourd'hui ou l'heure d'ouverture si c'est demain ou après
                const currentMinutes =
                    windowStart > currentDayStart && windowStart < currentDayEnd
                        ? windowStart.getUTCHours() * 60 +
                          windowStart.getUTCMinutes()
                        : openingMinutes;

                // On sélectionne la valeur la plus tardive entre l'ouverture du club et l'heure actuelle
                const effectiveOpeningMinutes = Math.max(
                    openingMinutes,
                    currentMinutes,
                );

                // Calcul combien de minutes se sont écoulées depuis l'ouverture officielle du club
                const startOffset = Math.max(
                    0,
                    effectiveOpeningMinutes - openingMinutes,
                );

                // Aligne le premier créneau de la journée sur la grille horaire stricte du terrain.
                // Cette formule garantit que les créneaux respectent l'intervalle fixe imposé
                // depuis l'heure d'ouverture, empêchant ainsi la création de créneaux asynchrones.
                //
                // Exemple d'alignement :
                // - Ouverture du club : 08:00 (480 min) | Durée d'un créneau : 90 min
                // - Heure actuelle : 09:00 (offset de 60 min par rapport à l'ouverture)
                // - Calcul du multiplicateur : Math.ceil(60 / 90) = 1 (on passe au créneau suivant)
                // - Résultat : 480 + (1 * 90) = 570 min, soit un premier créneau à 09:30.
                const firstSlotMinutes =
                    openingMinutes +
                    Math.ceil(startOffset / court.slotDuration) *
                        court.slotDuration;

                // Boucle créneau par créneau sur la journée
                for (
                    let startMinutes = firstSlotMinutes;
                    startMinutes + court.slotDuration <= closingMinutes;
                    startMinutes += court.slotDuration
                ) {
                    // Convertit les minutes en objets Date
                    const slotStart = toDateAtMinutes(
                        currentDayStart,
                        startMinutes,
                    );
                    const slotEnd = toDateAtMinutes(
                        currentDayStart,
                        startMinutes + court.slotDuration,
                    );

                    // Vérifie si le créneau est bien strictement dans la fenêtre demandée par l'utilisateur
                    if (slotStart < windowStart || slotEnd > windowEnd) {
                        continue;
                    }

                    // Vérifie si le créneau chevauche un match déjà réservé
                    const isOccupied = occupied.some(
                        (match) =>
                            slotStart < match.endTime &&
                            slotEnd > match.startTime,
                    );

                    if (!isOccupied) {
                        slots.push({
                            startTime: slotStart.toISOString(),
                            endTime: slotEnd.toISOString(),
                        });
                    }
                }
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
        const startMinutes =
            startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
        const endMinutes = endTime.getUTCHours() * 60 + endTime.getUTCMinutes();

        if (startMinutes < openingMinutes || endMinutes > closingMinutes) {
            res.status(400).json({
                message: "slot is outside club opening hours",
            });
            return;
        }

        if ((startMinutes - openingMinutes) % court.slotDuration !== 0) {
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
