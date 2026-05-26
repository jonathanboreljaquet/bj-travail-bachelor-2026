import * as z from "zod/v4";

export const isoTimeStr = z
    .string()
    .describe("Local time strictly in 'YYYY-MM-DDTHH:mm:ss' format.");

export const getAvailableSlotsInputSchema = z.object({
    city: z.string().optional(),
    courtType: z.enum(["INDOOR", "OUTDOOR", "COVERED"]).optional(),
    hasEquipmentBox: z.boolean().optional(),
    minPricePerPerson: z.number().optional(),
    maxPricePerPerson: z.number().optional(),
    slotDuration: z.number().int().optional(),
    maxSlotDuration: z.number().int().optional(),
    timeFrom: isoTimeStr.optional(),
    timeTo: isoTimeStr.optional(),
});

export const getOpenMatchesInputSchema = z.object({
    city: z.string().optional(),
    courtType: z.enum(["INDOOR", "OUTDOOR", "COVERED"]).optional(),
    hasEquipmentBox: z.boolean().optional(),
    minPricePerPerson: z.number().optional(),
    maxPricePerPerson: z.number().optional(),
    slotDuration: z.number().int().optional(),
    minSlotDuration: z.number().int().optional(),
    maxSlotDuration: z.number().int().optional(),
    availableSpots: z.number().int().optional(),
    minAvailableSpots: z.number().int().optional(),
    startTimeFrom: isoTimeStr.optional(),
    startTimeTo: isoTimeStr.optional(),
    endTimeFrom: isoTimeStr.optional(),
    endTimeTo: isoTimeStr.optional(),
    participantAverageLevel: z.number().optional(),
    participantAverageLevelTolerance: z.number().optional(),
});

export const joinOpenMatchInputSchema = z.object({
    matchId: z.number().int().nonoptional(),
});

export const createMatchFromSlotInputSchema = z.object({
    courtId: z.number().int().min(1),
    startTime: isoTimeStr,
    endTime: isoTimeStr,
});

export const weatherVerificationSchema = z.object({
    precipitationProbabilityPct: z.number().nullable(),
    windSpeedKmh: z.number().nullable(),
    temperatureCelsius: z.number().nullable(),
});

export const availableSlotVerificationSchema = z.object({
    court: z.object({
        id: z.number(),
        name: z.string(),
        type: z.string(),
        hasEquipmentBox: z.boolean(),
        pricePerPerson: z.number(),
        slotDuration: z.number(),
        club: z.object({
            name: z.string(),
            city: z.string(),
            postalCode: z.string(),
            openingTime: z.string(),
            closingTime: z.string(),
        }),
    }),
    availableSlots: z.array(
        z.object({
            startTime: z.string(),
            endTime: z.string(),
        }),
    ),
});

export const availableSlotListVerificationSchema = z.array(
    availableSlotVerificationSchema,
);

export const matchVerificationSchema = z.object({
    id: z.number(),
    startTime: z.string(),
    endTime: z.string(),
    status: z.string(),
    availableSpots: z.number(),
    court: z.object({
        name: z.string(),
        type: z.string(),
        hasEquipmentBox: z.boolean(),
        pricePerPerson: z.number(),
        slotDuration: z.number(),
        club: z.object({
            name: z.string(),
            city: z.string(),
            postalCode: z.string(),
            openingTime: z.string(),
            closingTime: z.string(),
        }),
    }),
    participants: z.array(
        z.object({
            user: z.object({
                firstname: z.string(),
                level: z.number(),
            }),
        }),
    ),
});

export const matchListVerificationSchema = z.array(matchVerificationSchema);

export const joinedMatchVerificationSchema = z.object({
    id: z.number(),
    status: z.string(),
    availableSpots: z.number(),
    startTime: z.string(),
    endTime: z.string(),
    creator_id: z.number(),
    court: z.object({
        name: z.string(),
        type: z.string(),
        club: z.object({
            name: z.string(),
            city: z.string(),
        }),
    }),
    participants: z.array(
        z.object({
            user: z.object({
                id: z.number(),
                firstname: z.string(),
                lastname: z.string(),
                email: z.email(),
                level: z.number(),
            }),
            joinedAt: z.string(),
        }),
    ),
});

export const joinOpenMatchVerificationSchema = z.object({
    message: z.string(),
    match: joinedMatchVerificationSchema,
});

export const createMatchFromSlotVerificationSchema =
    joinOpenMatchVerificationSchema;

export const weatherOutputSchema = z.object({
    precipitationProbabilityPct: z.number(),
    windSpeedKmh: z.number(),
    temperatureCelsius: z.number(),
});

export const availableSlotOutputSchema = z.object({
    court: z.object({
        name: z.string(),
        type: z.string(),
        hasEquipmentBox: z.boolean(),
        pricePerPerson: z.number(),
        club: z.object({
            name: z.string(),
            city: z.string(),
            postalCode: z.string(),
        }),
    }),
    availableSlots: z.array(
        z.object({
            startTime: z.string(),
            endTime: z.string(),
            weather: weatherOutputSchema.optional(),
        }),
    ),
});

export const getAvailableSlotsOutputSchema = z.object({
    availableSlots: z.array(availableSlotOutputSchema),
});

export const matchOutputSchema = z.object({
    id: z.number(),
    startTime: z.string(),
    endTime: z.string(),
    status: z.string(),
    availableSpots: z.number(),
    court: z.object({
        name: z.string(),
        type: z.string(),
        hasEquipmentBox: z.boolean(),
        pricePerPerson: z.number(),
        club: z.object({
            name: z.string(),
            city: z.string(),
            postalCode: z.string(),
        }),
    }),
    participants: z.array(
        z.object({
            user: z.object({
                firstname: z.string(),
                level: z.number(),
            }),
        }),
    ),
    weather: weatherOutputSchema.optional(),
});

export const getOpenMatchesOutputSchema = z.object({
    matches: z.array(matchOutputSchema),
});

export const joinedMatchOutputSchema = joinedMatchVerificationSchema;

export const joinOpenMatchOutputSchema = z.object({
    message: z.string(),
    match: joinedMatchOutputSchema,
});

export const createMatchFromSlotOutputSchema = joinOpenMatchOutputSchema;
