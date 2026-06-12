import { Request, Response } from "express";
import prisma from "../db";
import {
    parseBoolean,
    parseDate,
    parseNumber,
    normalizeString,
    MAX_UPCOMING_MATCHES,
    MAX_UPCOMING_MATCHES_MESSAGE,
} from "../utils/helper";
import { Prisma } from "../../generated/prisma/client";

/**
 * Recherche et filtre dynamiquement les matchs ouverts.
 * @param {Request} req - L'objet requête d'Express.
 * @param {string} [req.query.city] - (Optionnel) Filtre par ville du club (insensible à la casse).
 * @param {string} [req.query.hasEquipmentBox] - (Optionnel) Filtre sur la présence de matériel ("true" ou "false").
 * @param {number} [req.query.minPricePerPerson] - (Optionnel) Prix minimum par joueur.
 * @param {number} [req.query.maxPricePerPerson] - (Optionnel) Prix maximum par joueur.
 * @param {number} [req.query.slotDuration] - (Optionnel) Durée exacte du match en minutes.
 * @param {number} [req.query.minSlotDuration] - (Optionnel) Durée minimale du match en minutes.
 * @param {number} [req.query.maxSlotDuration] - (Optionnel) Durée maximale du match en minutes.
 * @param {string} [req.query.courtType] - (Optionnel) Type d'infrastructure ("INDOOR", "OUTDOOR" ou "COVERED").
 * @param {number} [req.query.availableSpots] - (Optionnel) Nombre exact de places restantes souhaité.
 * @param {number} [req.query.minAvailableSpots] - (Optionnel) Nombre minimum de places restantes.
 * @param {string} [req.query.startTimeFrom] - (Optionnel) Date/Heure de début minimum (format ISO).
 * @param {string} [req.query.startTimeTo] - (Optionnel) Date/Heure de début maximum (format ISO).
 * @param {string} [req.query.endTimeFrom] - (Optionnel) Date/Heure de fin minimum (format ISO).
 * @param {string} [req.query.endTimeTo] - (Optionnel) Date/Heure de fin maximum (format ISO).
 * @param {number} [req.query.participantAverageLevel] - (Optionnel) Niveau moyen cible recherché pour le match.
 * @param {number} [req.query.participantAverageLevelTolerance=0.5] - (Optionnel) Marge de tolérance autour du niveau moyen. Par défaut : 0.5.
 * @param {Response} res - L'objet réponse d'Express.
 * @returns {200} Succès : Retourne un tableau d'objets `match` correspondants aux critères.
 * @throws {500} Erreur interne : Déclenché en cas d'échec de la requête en base de données.
 */
export const getMatches = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const city =
            typeof req.query.city === "string"
                ? req.query.city.trim()
                : undefined;
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

        const hasEquipmentBox = parseBoolean(req.query.hasEquipmentBox);
        const minPricePerPerson = parseNumber(req.query.minPricePerPerson);
        const maxPricePerPerson = parseNumber(req.query.maxPricePerPerson);
        const slotDuration = parseNumber(req.query.slotDuration);
        const minSlotDuration = parseNumber(req.query.minSlotDuration);
        const maxSlotDuration = parseNumber(req.query.maxSlotDuration);
        const availableSpots = parseNumber(req.query.availableSpots);
        const minAvailableSpots = parseNumber(req.query.minAvailableSpots);
        const startTimeFrom = parseDate(req.query.startTimeFrom);
        const startTimeTo = parseDate(req.query.startTimeTo);
        const endTimeFrom = parseDate(req.query.endTimeFrom);
        const endTimeTo = parseDate(req.query.endTimeTo);

        const participantAverageLevel = parseNumber(
            req.query.participantAverageLevel,
        );
        const participantAverageLevelTolerance =
            parseNumber(req.query.participantAverageLevelTolerance) ?? 0.5;

        const now = new Date();

        const where: Prisma.MatchWhereInput = {
            status: "OPEN",
        };

        const effectiveStartTimeFrom =
            startTimeFrom && startTimeFrom > now ? startTimeFrom : now;
        where.startTime = {
            gte: effectiveStartTimeFrom,
            lte: startTimeTo,
        };

        where.availableSpots = {
            gt: 0,
            equals: availableSpots,
            gte: minAvailableSpots,
        };

        if (endTimeFrom !== undefined || endTimeTo !== undefined) {
            where.endTime = {
                gte: endTimeFrom,
                lte: endTimeTo,
            };
        }

        if (
            city ||
            normalizedCourtType ||
            hasEquipmentBox !== undefined ||
            minPricePerPerson !== undefined ||
            maxPricePerPerson !== undefined ||
            slotDuration !== undefined ||
            minSlotDuration !== undefined ||
            maxSlotDuration !== undefined
        ) {
            const courtWhere: Prisma.CourtWhereInput = {};

            if (hasEquipmentBox !== undefined) {
                courtWhere.hasEquipmentBox = hasEquipmentBox;
            }

            if (normalizedCourtType) {
                courtWhere.type = normalizedCourtType;
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

            if (city) {
                courtWhere.club = {
                    city: {
                        equals: normalizeString(city),
                        mode: "insensitive",
                    },
                };
            }

            where.court = courtWhere;
        }

        const matches = await prisma.match.findMany({
            where,
            orderBy: { startTime: "asc" },
            select: {
                id: true,
                startTime: true,
                endTime: true,
                status: true,
                availableSpots: true,
                court: {
                    select: {
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
                },
                participants: {
                    select: {
                        user: {
                            select: {
                                firstname: true,
                                level: true,
                            },
                        },
                    },
                },
            },
        });

        // Filtrage supplémentaire côté application pour le niveau moyen des participants
        const formattedMatches = matches.filter((match) => {
            if (participantAverageLevel === undefined) return true;
            if (match.participants.length === 0) return false;

            const averageLevel =
                match.participants.reduce((acc, p) => acc + p.user.level, 0) /
                match.participants.length;

            return (
                Math.abs(averageLevel - participantAverageLevel) <=
                participantAverageLevelTolerance
            );
        });

        res.status(200).json(formattedMatches);
    } catch (error) {
        res.status(500).json({
            message: "Error while fetching matches",
            error: error,
        });
    }
};

/**
 * Permet à un utilisateur authentifié de rejoindre un match existant.
 * @param {Request} req - L'objet requête d'Express.
 * @param {string} req.params.matchId - (Requis) L'identifiant unique du match à rejoindre.
 * @param {Response} res - L'objet réponse d'Express.
 * @returns {200} Succès : L'utilisateur est inscrit, retourne le match mis à jour.
 * @throws {400} Mauvaise requête : ID invalide, match fermé, match complet, ou utilisateur déjà inscrit.
 * @throws {401} Non autorisé : L'utilisateur n'est pas connecté.
 * @throws {403} Interdit : L'utilisateur a déjà atteint sa limite de matchs futurs.
 * @throws {404} Non trouvé : Le match n'existe pas.
 * @throws {500} Erreur interne : Échec de la transaction ou problème inattendu.
 */
export const joinMatch = async (req: Request, res: Response): Promise<void> => {
    try {
        const matchIdParam = req.params.matchId;
        const authUser = res.locals.authUser as
            | { userId: number; email: string }
            | undefined;

        if (!matchIdParam || isNaN(Number(matchIdParam))) {
            res.status(400).json({ message: "invalid match ID" });
            return;
        }

        if (!authUser) {
            res.status(401).json({ message: "unauthorized" });
            return;
        }

        const matchId = Number(matchIdParam);
        const userId = authUser.userId;

        const upcomingMatchesCount = await prisma.participant.count({
            where: {
                user_id: userId,
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

        const result = await prisma.$transaction(async (tx) => {
            const currentMatch = await tx.match.findUnique({
                where: { id: matchId },
                select: { status: true, availableSpots: true },
            });

            if (!currentMatch) throw new Error("MATCH_NOT_FOUND");
            if (currentMatch.status !== "OPEN")
                throw new Error("MATCH_NOT_OPEN");
            if (currentMatch.availableSpots <= 0)
                throw new Error("NO_AVAILABLE_SPOTS");

            const existingParticipant = await tx.participant.findUnique({
                where: {
                    user_id_match_id: { user_id: userId, match_id: matchId },
                },
            });

            if (existingParticipant) throw new Error("ALREADY_JOINED");

            await tx.participant.create({
                data: {
                    user_id: userId,
                    match_id: matchId,
                },
            });

            const newAvailableSpots = currentMatch.availableSpots - 1;
            const newStatus =
                newAvailableSpots === 0 ? "COMPLETED" : currentMatch.status;

            return tx.match.update({
                where: { id: matchId },
                data: {
                    availableSpots: newAvailableSpots,
                    status: newStatus,
                },
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

        res.status(200).json({
            message: "successfully joined match",
            match: result,
        });
    } catch (error) {
        if (error instanceof Error) {
            switch (error.message) {
                case "MATCH_NOT_FOUND":
                    res.status(404).json({ message: "match not found" });
                    return;
                case "MATCH_NOT_OPEN":
                    res.status(400).json({ message: "match is not open" });
                    return;
                case "NO_AVAILABLE_SPOTS":
                    res.status(400).json({ message: "no available spots" });
                    return;
                case "ALREADY_JOINED":
                    res.status(400).json({
                        message: "user already joined this match",
                    });
                    return;
            }
        }

        res.status(500).json({
            message: "Error while joining match",
            error: error,
        });
    }
};

/**
 * Récupère tous les matchs de l'utilisateur connecté, quel que soit leur statut.
 * @param {Request} req - L'objet requête d'Express.
 * @param {Response} res - L'objet réponse d'Express.
 * @returns {200} Succès : Retourne le tableau des matchs de l'utilisateur, triés par date de début décroissante.
 * @throws {401} Non autorisé : L'utilisateur n'est pas connecté.
 * @throws {500} Erreur interne : Déclenché en cas d'échec de la requête en base de données.
 */
export const getMyMatches = async (
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

        const userId = authUser.userId;

        const matches = await prisma.match.findMany({
            where: {
                participants: {
                    some: { user_id: userId },
                },
            },
            orderBy: { startTime: "asc" },
            select: {
                id: true,
                startTime: true,
                endTime: true,
                status: true,
                availableSpots: true,
                creator_id: true,
                court: {
                    select: {
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
                },
                participants: {
                    select: {
                        user: {
                            select: {
                                firstname: true,
                                level: true,
                            },
                        },
                    },
                },
            },
        });

        res.status(200).json(matches);
    } catch (error) {
        res.status(500).json({
            message: "Error while fetching user matches",
            error: error,
        });
    }
};
