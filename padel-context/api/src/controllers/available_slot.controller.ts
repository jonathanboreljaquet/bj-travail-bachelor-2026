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
} from "../utils/helper";

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
        const limit = parseNumber(req.query.limit) ?? 20;
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
        const now = new Date();

        const dayStart = new Date(now);
        dayStart.setUTCHours(0, 0, 0, 0);

        const defaultWindowStart = now;
        const defaultWindowEnd = new Date(dayStart);
        defaultWindowEnd.setUTCDate(defaultWindowEnd.getUTCDate() + 7);
        const windowStart = timeFrom ?? defaultWindowStart;
        const windowEnd = timeTo ?? defaultWindowEnd;

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
                ...(slotDuration !== undefined ? { equals: slotDuration } : {}),
                ...(minSlotDuration !== undefined
                    ? { gte: minSlotDuration }
                    : {}),
                ...(maxSlotDuration !== undefined
                    ? { lte: maxSlotDuration }
                    : {}),
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

        const availableSlots = filteredCourts.map((court) => {
            const openingMinutes = toMinutes(court.club.openingTime);
            const closingMinutes = toMinutes(court.club.closingTime);
            const occupied = byCourt.get(court.id) ?? [];

            const slots: Array<{ startTime: string; endTime: string }> = [];
            const rangeDayStart = new Date(windowStart);
            rangeDayStart.setUTCHours(0, 0, 0, 0);

            if (limit <= 0) {
                return {
                    court,
                    availableSlots: slots,
                };
            }

            slotSearch: for (
                let dayReference = new Date(rangeDayStart);
                dayReference < windowEnd;
                dayReference.setUTCDate(dayReference.getUTCDate() + 1)
            ) {
                const currentDayStart = new Date(dayReference);
                currentDayStart.setUTCHours(0, 0, 0, 0);

                const nextDayReference = new Date(dayReference);
                nextDayReference.setUTCDate(nextDayReference.getUTCDate() + 1);
                const currentDayEnd = new Date(nextDayReference);
                currentDayEnd.setUTCHours(0, 0, 0, 0);

                const currentMinutes =
                    windowStart > currentDayStart && windowStart < currentDayEnd
                        ? windowStart.getUTCHours() * 60 +
                          windowStart.getUTCMinutes()
                        : openingMinutes;
                const effectiveOpeningMinutes = Math.max(
                    openingMinutes,
                    currentMinutes,
                );
                const startOffset = Math.max(
                    0,
                    effectiveOpeningMinutes - openingMinutes,
                );
                const firstSlotMinutes =
                    openingMinutes +
                    Math.ceil(startOffset / court.slotDuration) *
                        court.slotDuration;

                for (
                    let startMinutes = firstSlotMinutes;
                    startMinutes + court.slotDuration <= closingMinutes;
                    startMinutes += court.slotDuration
                ) {
                    if (slots.length >= limit) {
                        break slotSearch;
                    }
                    const slotStart = toDateAtMinutes(
                        currentDayStart,
                        startMinutes,
                    );
                    const slotEnd = toDateAtMinutes(
                        currentDayStart,
                        startMinutes + court.slotDuration,
                    );

                    if (slotStart < windowStart || slotEnd > windowEnd) {
                        continue;
                    }

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
                        if (slots.length >= limit) {
                            break slotSearch;
                        }
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
        const dayStart = new Date(now);
        dayStart.setUTCHours(0, 0, 0, 0);
        const windowEnd = new Date(dayStart);
        windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

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
