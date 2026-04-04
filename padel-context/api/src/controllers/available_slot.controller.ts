import { Request, Response } from "express";
import prisma from "../db";
import {
    parseBoolean,
    parseDate,
    parseNumber,
    toDateAtMinutes,
    toMinutes,
} from "../utils/helper";

export const getAvailableSlots = async (
    req: Request,
    res: Response,
): Promise<any> => {
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
        const startTimeFrom = parseDate(req.query.startTimeFrom);
        const startTimeTo = parseDate(req.query.startTimeTo);
        const endTimeFrom = parseDate(req.query.endTimeFrom);
        const endTimeTo = parseDate(req.query.endTimeTo);
        const courtType = typeof req.query.courtType === "string" 
            ? req.query.courtType.trim().toUpperCase() : undefined;
        const normalizedCourtType = 
            courtType === "INDOOR" || courtType === "OUTDOOR" || courtType === "COVERED"
                ? courtType : undefined;
        const now = new Date();

        const dayStart = new Date(now);
        dayStart.setUTCHours(0, 0, 0, 0);

        const windowStart = now;
        const windowEnd = new Date(dayStart);
        windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

        if (windowEnd <= windowStart) {
            res.status(200).json([]);
            return;
        }

        const courtWhere: any = {};

        if (city) {
            courtWhere.club = {
                city: {
                    equals: city,
                },
            };
        }

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
                        openingTime: true,
                        closingTime: true,
                    },
                },
            },
        });

        if (courts.length === 0) {
            res.status(200).json([]);
            return;
        }

        const courtIds = courts.map((court) => court.id);

        const matchWhere: any = {
            court_id: {
                in: courtIds,
            },
            status: {
                in: ["OPEN", "COMPLETED"],
            },
            startTime: {
                ...(startTimeFrom ? { gte: startTimeFrom } : {}),
                ...(startTimeTo ? { lte: startTimeTo } : {}),
                lt: windowEnd,
            },
            endTime: {
                ...(endTimeFrom ? { gte: endTimeFrom } : {}),
                ...(endTimeTo ? { lte: endTimeTo } : {}),
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

        const availableSlots = courts.map((court) => {
            const openingMinutes = toMinutes(court.club.openingTime);
            const closingMinutes = toMinutes(court.club.closingTime);
            const occupied = byCourt.get(court.id) ?? [];

            const slots: Array<{ startTime: string; endTime: string }> = [];
            for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
                const dayReference = new Date(dayStart);
                dayReference.setUTCDate(dayReference.getUTCDate() + dayOffset);
                const currentDayStart = new Date(dayReference);
                currentDayStart.setUTCHours(0, 0, 0, 0);

                const nextDayReference = new Date(dayReference);
                nextDayReference.setUTCDate(nextDayReference.getUTCDate() + 1);
                const currentDayEnd = new Date(nextDayReference);
                currentDayEnd.setUTCHours(0, 0, 0, 0);

                const currentMinutes =
                    windowStart > currentDayStart && windowStart < currentDayEnd
                        ? windowStart.getUTCHours() * 60 + windowStart.getUTCMinutes()
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
        });
    }
};
