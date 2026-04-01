import { Request, Response } from 'express';
import prisma from '../db';

type MatchStatus = 'OPEN' | 'COMPLETED' | 'CANCELED';

const parseBoolean = (value: unknown): boolean | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === 'true') {
        return true;
    }
    if (normalizedValue === 'false') {
        return false;
    }

    return undefined;
};

const parseNumber = (value: unknown): number | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
        return undefined;
    }

    return numberValue;
};

const parseDate = (value: unknown): Date | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
        return undefined;
    }

    return dateValue;
};

const parseStatus = (value: unknown): MatchStatus => {
    if (typeof value !== 'string') {
        return 'OPEN';
    }

    const normalizedStatus = value.trim().toUpperCase();
    if (normalizedStatus === 'OPEN' || normalizedStatus === 'COMPLETED' || normalizedStatus === 'CANCELED') {
        return normalizedStatus;
    }

    return 'OPEN';
};

export const getMatches = async (req: Request, res: Response): Promise<any> => {
    try {
        const status = parseStatus(req.query.status);
        const city = typeof req.query.city === 'string' ? req.query.city.trim() : undefined;
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
        const participantAverageLevel = parseNumber(req.query.participantAverageLevel);
        const participantAverageLevelTolerance = parseNumber(req.query.participantAverageLevelTolerance) ?? 0.5;
        const includeParam = typeof req.query.include === 'string' ? req.query.include : '';

        const includes = new Set(
            includeParam
                .split(',')
                .map((includeValue) => includeValue.trim().toLowerCase())
                .filter(Boolean),
        );

        const includeParticipants = includes.size === 0 || includes.has('participants');
        const includeClub = includes.size === 0 || includes.has('club');
        const includeCourt = includes.size === 0 || includes.has('court');

        const where: any = {
            status,
        };

        if (status === 'OPEN') {
            where.availableSpots = {
                ...(where.availableSpots ?? {}),
                gt: 0,
            };
        }

        if (availableSpots !== undefined) {
            where.availableSpots = {
                ...(where.availableSpots ?? {}),
                gte: availableSpots,
            };
        }

        if (minAvailableSpots !== undefined) {
            where.availableSpots = {
                ...(where.availableSpots ?? {}),
                gte: minAvailableSpots,
            };
        }

        if (startTimeFrom || startTimeTo) {
            where.startTime = {
                ...(startTimeFrom ? { gte: startTimeFrom } : {}),
                ...(startTimeTo ? { lte: startTimeTo } : {}),
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
                    mode: 'insensitive',
                },
            };
        }

        if (hasEquipmentBox !== undefined) {
            where.court.hasEquipmentBox = hasEquipmentBox;
        }

        if (minPricePerPerson !== undefined || maxPricePerPerson !== undefined) {
            where.court.pricePerPerson = {
                ...(minPricePerPerson !== undefined ? { gte: minPricePerPerson } : {}),
                ...(maxPricePerPerson !== undefined ? { lte: maxPricePerPerson } : {}),
            };
        }

        if (slotDuration !== undefined || minSlotDuration !== undefined || maxSlotDuration !== undefined) {
            where.court.slotDuration = {
                ...(slotDuration !== undefined ? { equals: slotDuration } : {}),
                ...(minSlotDuration !== undefined ? { gte: minSlotDuration } : {}),
                ...(maxSlotDuration !== undefined ? { lte: maxSlotDuration } : {}),
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
                equipmentRental: true,
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

        const formattedMatches = matches
            .map((match) => ({
            id: match.id,
            startTime: match.startTime,
            endTime: match.endTime,
            status: match.status,
            availableSpots: match.availableSpots,
            equipmentRental: match.equipmentRental,
            club: match.court.club,
            court: {
                name: match.court.name,
                type: match.court.type,
                hasEquipmentBox: match.court.hasEquipmentBox,
                pricePerPerson: match.court.pricePerPerson,
                slotDuration: match.court.slotDuration,
            },
            participants: match.participants.map((participant) => participant.user),
            }))
            .filter((match) => {
                if (participantAverageLevel === undefined) {
                    return true;
                }

                if (match.participants.length === 0) {
                    return false;
                }

                const averageLevel =
                    match.participants.reduce((accumulator, participant) => accumulator + participant.level, 0) /
                    match.participants.length;

                return Math.abs(averageLevel - participantAverageLevel) <= participantAverageLevelTolerance;
            })
            .map((match) => ({
                id: match.id,
                startTime: match.startTime,
                endTime: match.endTime,
                status: match.status,
                availableSpots: match.availableSpots,
                equipmentRental: match.equipmentRental,
                ...(includeClub ? { club: match.club } : {}),
                ...(includeCourt ? { court: match.court } : {}),
                ...(includeParticipants ? { participants: match.participants } : {}),
            }));

        res.status(200).json(formattedMatches);
    } catch (error) {
        res.status(500).json({ message: 'Error while fetching open matches' });
    }
};

