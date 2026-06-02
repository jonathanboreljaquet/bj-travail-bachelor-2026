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
        const limit = parseNumber(req.query.limit) ?? 10;

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
            ...(startTimeTo ? { lte: startTimeTo } : {}),
        };

        where.availableSpots = {
            gt: 0,
            ...(availableSpots !== undefined ? { equals: availableSpots } : {}),
            ...(minAvailableSpots !== undefined
                ? { gte: minAvailableSpots }
                : {}),
        };

        if (endTimeFrom || endTimeTo) {
            where.endTime = {
                ...(endTimeFrom ? { gte: endTimeFrom } : {}),
                ...(endTimeTo ? { lte: endTimeTo } : {}),
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
            const courtWhere = (where.court ??= {});

            if (hasEquipmentBox !== undefined)
                courtWhere.hasEquipmentBox = hasEquipmentBox;
            if (normalizedCourtType) courtWhere.type = normalizedCourtType;

            if (
                minPricePerPerson !== undefined ||
                maxPricePerPerson !== undefined
            ) {
                courtWhere.pricePerPerson = {
                    ...(minPricePerPerson !== undefined
                        ? { gte: minPricePerPerson }
                        : {}),
                    ...(maxPricePerPerson !== undefined
                        ? { lte: maxPricePerPerson }
                        : {}),
                };
            }

            if (
                slotDuration !== undefined ||
                minSlotDuration !== undefined ||
                maxSlotDuration !== undefined
            ) {
                courtWhere.slotDuration = {
                    ...(slotDuration !== undefined
                        ? { equals: slotDuration }
                        : {}),
                    ...(minSlotDuration !== undefined
                        ? { gte: minSlotDuration }
                        : {}),
                    ...(maxSlotDuration !== undefined
                        ? { lte: maxSlotDuration }
                        : {}),
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
        }

        const matches = await prisma.match.findMany({
            where,
            take: limit * 3,
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

        const finalMatches = formattedMatches.slice(0, limit);

        res.status(200).json(finalMatches);
    } catch (error) {
        res.status(500).json({
            message: "Error while fetching matches",
            error: error,
        });
    }
};

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

        const match = await prisma.match.findUnique({
            where: { id: matchId },
            select: {
                id: true,
                status: true,
                availableSpots: true,
                startTime: true,
                endTime: true,
                court_id: true,
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
            },
        });

        if (!match) {
            res.status(404).json({ message: "match not found" });
            return;
        }

        if (match.status !== "OPEN") {
            res.status(400).json({ message: "match is not open" });
            return;
        }

        if (match.availableSpots <= 0) {
            res.status(400).json({ message: "no available spots" });
            return;
        }

        const existingParticipant = await prisma.participant.findUnique({
            where: {
                user_id_match_id: {
                    user_id: userId,
                    match_id: matchId,
                },
            },
        });

        if (existingParticipant) {
            res.status(400).json({ message: "user already joined this match" });
            return;
        }

        const result = await prisma.$transaction(async (tx) => {
            await tx.participant.create({
                data: {
                    user_id: userId,
                    match_id: matchId,
                },
            });

            const newAvailableSpots = match.availableSpots - 1;
            const newStatus =
                newAvailableSpots === 0 ? "COMPLETED" : match.status;

            const updatedMatch = await tx.match.update({
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

            return updatedMatch;
        });

        res.status(200).json({
            message: "successfully joined match",
            match: result,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error while joining match",
            error: error,
        });
    }
};
