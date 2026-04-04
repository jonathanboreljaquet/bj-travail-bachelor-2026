import { Request, Response } from "express";
import prisma from "../db";
import { parseBoolean, parseDate, parseNumber } from "../utils/helper";

export const getMatches = async (req: Request, res: Response): Promise<any> => {
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

        const where: any = {
            status: "OPEN",
        };

        const effectiveStartTimeFrom =
            startTimeFrom && startTimeFrom > now ? startTimeFrom : now;
        where.startTime = {
            gte: effectiveStartTimeFrom,
            ...(startTimeTo ? { lte: startTimeTo } : {}),
        };

        where.availableSpots = {
            ...(where.availableSpots ?? {}),
            gt: 0,
        };

        if (availableSpots !== undefined) {
            where.availableSpots = {
                ...(where.availableSpots ?? {}),
                equals: availableSpots,
            };
        }

        if (minAvailableSpots !== undefined) {
            where.availableSpots = {
                ...(where.availableSpots ?? {}),
                gte: minAvailableSpots,
            };
        }

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
            where.court = {};
        }

        if (city) {
            where.court.club = {
                city: {
                    equals: city,
                },
            };
        }

        if (hasEquipmentBox !== undefined) {
            where.court.hasEquipmentBox = hasEquipmentBox;
        }

        if (normalizedCourtType) {
            where.court.type = normalizedCourtType;
        }

        if (
            minPricePerPerson !== undefined ||
            maxPricePerPerson !== undefined
        ) {
            where.court.pricePerPerson = {
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
            where.court.slotDuration = {
                ...(slotDuration !== undefined ? { equals: slotDuration } : {}),
                ...(minSlotDuration !== undefined
                    ? { gte: minSlotDuration }
                    : {}),
                ...(maxSlotDuration !== undefined
                    ? { lte: maxSlotDuration }
                    : {}),
            };
        }

        const matches = await prisma.match.findMany({
            where,
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
                                lastname: true,
                                email: true,
                                level: true,
                            },
                        },
                    },
                },
            },
        });

        const formattedMatches = matches.filter((match) => {
            if (participantAverageLevel === undefined) {
                return true;
            }

            if (match.participants.length === 0) {
                return false;
            }

            const averageLevel =
                match.participants.reduce(
                    (accumulator, participant) =>
                        accumulator + participant.user.level,
                    0,
                ) / match.participants.length;

            return (
                Math.abs(averageLevel - participantAverageLevel) <=
                participantAverageLevelTolerance
            );
        });

        res.status(200).json(formattedMatches);
    } catch (error) {
        res.status(500).json({ message: "Error while fetching matches" });
    }
};
