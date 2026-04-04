import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import app from "../../src/app";
import prisma from "../../src/db";

const uniquePrefix = `available-slots-integration-${Date.now()}`;

const createdClubIds: number[] = [];
const createdCourtIds: number[] = [];
const createdMatchIds: number[] = [];
const createdUserIds: number[] = [];

const createUtcDate = (
    referenceDay: Date,
    hours: number,
    minutes = 0,
): Date => {
    const date = new Date(referenceDay);
    date.setUTCHours(hours, minutes, 0, 0);
    return date;
};

const getCourt = <T extends { court: { id: number } }>(
    payload: T[],
    courtId: number,
) => {
    const court = payload.find((entry) => entry.court.id === courtId);
    if (!court) {
        throw new Error(`Court ${courtId} not found in payload`);
    }

    return court;
};

const createUser = async (suffix: string) => {
    const user = await prisma.user.create({
        data: {
            firstname: `${uniquePrefix}-${suffix}`,
            lastname: "User",
            email: `${uniquePrefix}-${suffix}@test.dev`,
            password: "password123",
            level: 3,
        },
    });

    createdUserIds.push(user.id);
    return user;
};

const createCourtWithClub = async ({
    clubName,
    city,
    courtName,
    type,
    hasEquipmentBox,
    pricePerPerson,
    slotDuration,
    openingTime,
    closingTime,
}: {
    clubName: string;
    city: string;
    courtName: string;
    type: "INDOOR" | "OUTDOOR" | "COVERED";
    hasEquipmentBox: boolean;
    pricePerPerson: number;
    slotDuration: number;
    openingTime: string;
    closingTime: string;
}) => {
    const club = await prisma.club.create({
        data: {
            name: `${uniquePrefix}-${clubName}`,
            city,
            openingTime,
            closingTime,
        },
    });

    createdClubIds.push(club.id);

    const court = await prisma.court.create({
        data: {
            name: `${uniquePrefix}-${courtName}`,
            type,
            hasEquipmentBox,
            pricePerPerson,
            slotDuration,
            club_id: club.id,
        },
    });

    createdCourtIds.push(court.id);
    return court;
};

const createMatch = async ({
    courtId,
    creatorId,
    startTime,
    durationMinutes,
    status,
    availableSpots,
}: {
    courtId: number;
    creatorId: number;
    startTime: Date;
    durationMinutes: number;
    status: "OPEN" | "COMPLETED" | "CANCELED";
    availableSpots: number;
}) => {
    const endTime = new Date(startTime);
    endTime.setUTCMinutes(endTime.getUTCMinutes() + durationMinutes);

    const match = await prisma.match.create({
        data: {
            startTime,
            endTime,
            status,
            availableSpots,
            court_id: courtId,
            creator_id: creatorId,
        },
    });

    createdMatchIds.push(match.id);
    return match;
};

describe("[INTEGRATION TEST] GET /api/available-slots", () => {
    let mainCourtId: number;
    let secondaryCourtId: number;
    let mainCity: string;
    let secondaryCity: string;
    let matchDay: Date;
    let openMatchStart: Date;
    let completedMatchStart: Date;
    let canceledMatchStart: Date;

    beforeAll(async () => {
        const creator = await createUser("creator");

        const mainCourt = await createCourtWithClub({
            clubName: "main-club",
            city: `${uniquePrefix}-Geneva`,
            courtName: "main-court",
            type: "OUTDOOR",
            hasEquipmentBox: true,
            pricePerPerson: 15,
            slotDuration: 60,
            openingTime: "07:00",
            closingTime: "21:00",
        });

        const secondaryCourt = await createCourtWithClub({
            clubName: "secondary-club",
            city: `${uniquePrefix}-Carouge`,
            courtName: "secondary-court",
            type: "INDOOR",
            hasEquipmentBox: false,
            pricePerPerson: 25,
            slotDuration: 90,
            openingTime: "08:00",
            closingTime: "22:00",
        });

        matchDay = new Date();
        matchDay.setUTCDate(matchDay.getUTCDate() + 1);
        matchDay.setUTCHours(0, 0, 0, 0);

        openMatchStart = createUtcDate(matchDay, 9, 0);
        completedMatchStart = createUtcDate(matchDay, 11, 0);
        canceledMatchStart = createUtcDate(matchDay, 13, 0);

        await createMatch({
            courtId: mainCourt.id,
            creatorId: creator.id,
            startTime: openMatchStart,
            durationMinutes: 60,
            status: "OPEN",
            availableSpots: 2,
        });

        await createMatch({
            courtId: mainCourt.id,
            creatorId: creator.id,
            startTime: completedMatchStart,
            durationMinutes: 60,
            status: "COMPLETED",
            availableSpots: 0,
        });

        await createMatch({
            courtId: mainCourt.id,
            creatorId: creator.id,
            startTime: canceledMatchStart,
            durationMinutes: 60,
            status: "CANCELED",
            availableSpots: 2,
        });

        mainCourtId = mainCourt.id;
        secondaryCourtId = secondaryCourt.id;
        mainCity = `${uniquePrefix}-Geneva`;
        secondaryCity = `${uniquePrefix}-Carouge`;
    });

    afterAll(async () => {
        await prisma.participant.deleteMany({
            where: {
                match_id: { in: createdMatchIds },
            },
        });

        await prisma.match.deleteMany({
            where: {
                id: { in: createdMatchIds },
            },
        });

        await prisma.court.deleteMany({
            where: {
                id: { in: createdCourtIds },
            },
        });

        await prisma.club.deleteMany({
            where: {
                id: { in: createdClubIds },
            },
        });

        await prisma.user.deleteMany({
            where: {
                id: { in: createdUserIds },
            },
        });

        await prisma.$disconnect();
    });

    it("returns HTTP 200", async () => {
        const response = await request(app).get("/api/available-slots");
        expect(response.status).toBe(200);
    });

    it("returns both courts when no filter is provided", async () => {
        const response = await request(app).get("/api/available-slots");
        const payload = response.body as Array<{
            court: { id: number };
        }>;

        expect(response.status).toBe(200);
        expect(payload.map((entry) => entry.court.id)).toEqual(
            expect.arrayContaining([mainCourtId, secondaryCourtId]),
        );
    });

    it("filters by city", async () => {
        const response = await request(app)
            .get("/api/available-slots")
            .query({ city: mainCity });
        const payload = response.body as Array<{
            court: { id: number; club: { city: string } };
        }>;

        expect(response.status).toBe(200);
        expect(payload).toHaveLength(1);
        expect(payload[0].court.id).toBe(mainCourtId);
        expect(payload[0].court.club.city).toBe(mainCity);
    });

    it("filters by hasEquipmentBox", async () => {
        const response = await request(app)
            .get("/api/available-slots")
            .query({ city: mainCity, hasEquipmentBox: "true" });
        const payload = response.body as Array<{ court: { id: number } }>;

        expect(response.status).toBe(200);
        expect(payload).toHaveLength(1);
        expect(payload[0].court.id).toBe(mainCourtId);
    });

    it("filters by minPricePerPerson", async () => {
        const response = await request(app)
            .get("/api/available-slots")
            .query({ city: secondaryCity, minPricePerPerson: "20" });
        const payload = response.body as Array<{ court: { id: number } }>;

        expect(response.status).toBe(200);
        expect(payload).toHaveLength(1);
        expect(payload[0].court.id).toBe(secondaryCourtId);
    });

    it("filters by maxPricePerPerson", async () => {
        const response = await request(app)
            .get("/api/available-slots")
            .query({ city: mainCity, maxPricePerPerson: "20" });
        const payload = response.body as Array<{ court: { id: number } }>;

        expect(response.status).toBe(200);
        expect(payload).toHaveLength(1);
        expect(payload[0].court.id).toBe(mainCourtId);
    });

    it("filters by slotDuration", async () => {
        const response = await request(app)
            .get("/api/available-slots")
            .query({ city: mainCity, slotDuration: "60" });
        const payload = response.body as Array<{ court: { id: number } }>;

        expect(response.status).toBe(200);
        expect(payload).toHaveLength(1);
        expect(payload[0].court.id).toBe(mainCourtId);
    });

    it("filters by minSlotDuration", async () => {
        const response = await request(app)
            .get("/api/available-slots")
            .query({ city: secondaryCity, minSlotDuration: "80" });
        const payload = response.body as Array<{ court: { id: number } }>;

        expect(response.status).toBe(200);
        expect(payload).toHaveLength(1);
        expect(payload[0].court.id).toBe(secondaryCourtId);
    });

    it("filters by maxSlotDuration", async () => {
        const response = await request(app)
            .get("/api/available-slots")
            .query({ city: mainCity, maxSlotDuration: "80" });
        const payload = response.body as Array<{ court: { id: number } }>;

        expect(response.status).toBe(200);
        expect(payload).toHaveLength(1);
        expect(payload[0].court.id).toBe(mainCourtId);
    });

    it("filters by courtType", async () => {
        const response = await request(app)
            .get("/api/available-slots")
            .query({ city: secondaryCity, courtType: "indoor" });
        const payload = response.body as Array<{ court: { id: number; type: string } }>;

        expect(response.status).toBe(200);
        expect(payload).toHaveLength(1);
        expect(payload[0].court.id).toBe(secondaryCourtId);
        expect(payload[0].court.type).toBe("INDOOR");
    });

    it("filters slots by startTimeFrom", async () => {
        const startTimeFrom = createUtcDate(matchDay, 9, 30);
        const response = await request(app)
            .get("/api/available-slots")
            .query({
                city: mainCity,
                startTimeFrom: startTimeFrom.toISOString(),
            });
        const payload = response.body as Array<{
            court: { id: number };
            availableSlots: Array<{ startTime: string; endTime: string }>;
        }>;

        const mainCourt = getCourt(payload, mainCourtId);
        const daySlots = mainCourt.availableSlots.filter((slot) =>
            slot.startTime.startsWith(matchDay.toISOString().slice(0, 10)),
        );
        const slotStarts = daySlots.map((slot) => slot.startTime);

        expect(slotStarts).toContain(openMatchStart.toISOString());
    });

    it("filters slots by startTimeTo", async () => {
        const response = await request(app)
            .get("/api/available-slots")
            .query({ city: mainCity, startTimeTo: openMatchStart.toISOString() });
        const payload = response.body as Array<{
            court: { id: number };
            availableSlots: Array<{ startTime: string; endTime: string }>;
        }>;

        const mainCourt = getCourt(payload, mainCourtId);
        const daySlots = mainCourt.availableSlots.filter((slot) =>
            slot.startTime.startsWith(matchDay.toISOString().slice(0, 10)),
        );
        const slotStarts = daySlots.map((slot) => slot.startTime);

        expect(slotStarts).not.toContain(openMatchStart.toISOString());
        expect(slotStarts).toContain(completedMatchStart.toISOString());
    });

    it("filters slots by endTimeFrom", async () => {
        const response = await request(app)
            .get("/api/available-slots")
            .query({
                city: mainCity,
                endTimeFrom: completedMatchStart.toISOString(),
            });
        const payload = response.body as Array<{
            court: { id: number };
            availableSlots: Array<{ startTime: string; endTime: string }>;
        }>;

        const mainCourt = getCourt(payload, mainCourtId);
        const daySlots = mainCourt.availableSlots.filter((slot) =>
            slot.startTime.startsWith(matchDay.toISOString().slice(0, 10)),
        );
        const slotStarts = daySlots.map((slot) => slot.startTime);

        expect(slotStarts).toContain(openMatchStart.toISOString());
        expect(slotStarts).not.toContain(completedMatchStart.toISOString());
    });

    it("filters slots by endTimeTo", async () => {
        const response = await request(app)
            .get("/api/available-slots")
            .query({ city: mainCity, endTimeTo: openMatchStart.toISOString() });
        const payload = response.body as Array<{
            court: { id: number };
            availableSlots: Array<{ startTime: string; endTime: string }>;
        }>;

        const mainCourt = getCourt(payload, mainCourtId);
        const daySlots = mainCourt.availableSlots.filter((slot) =>
            slot.startTime.startsWith(matchDay.toISOString().slice(0, 10)),
        );
        const slotStarts = daySlots.map((slot) => slot.startTime);

        expect(slotStarts).toContain(openMatchStart.toISOString());
        expect(slotStarts).toContain(completedMatchStart.toISOString());
    });

        it("keeps CANCELED matches available", async () => {
        const response = await request(app).get("/api/available-slots");
        const payload = response.body as Array<{
            court: { id: number };
            availableSlots: Array<{ startTime: string; endTime: string }>;
        }>;

        const mainCourt = getCourt(payload, mainCourtId);
        const daySlots = mainCourt.availableSlots.filter((slot) =>
            slot.startTime.startsWith(matchDay.toISOString().slice(0, 10)),
        );
        const slotStarts = daySlots.map((slot) => slot.startTime);

        expect(slotStarts).not.toContain(openMatchStart.toISOString());
        expect(slotStarts).not.toContain(completedMatchStart.toISOString());
        expect(slotStarts).toContain(canceledMatchStart.toISOString());
    });

    it("blocks OPEN matches", async () => {
        const response = await request(app).get("/api/available-slots");
        const payload = response.body as Array<{
            court: { id: number };
            availableSlots: Array<{ startTime: string; endTime: string }>;
        }>;

        const mainCourt = getCourt(payload, mainCourtId);
        const daySlots = mainCourt.availableSlots.filter((slot) =>
            slot.startTime.startsWith(matchDay.toISOString().slice(0, 10)),
        );
        const slotStarts = daySlots.map((slot) => slot.startTime);

        expect(slotStarts).not.toContain(openMatchStart.toISOString());
    });

    it("blocks COMPLETED matches", async () => {
        const response = await request(app).get("/api/available-slots");
        const payload = response.body as Array<{
            court: { id: number };
            availableSlots: Array<{ startTime: string; endTime: string }>;
        }>;

        const mainCourt = getCourt(payload, mainCourtId);
        const daySlots = mainCourt.availableSlots.filter((slot) =>
            slot.startTime.startsWith(matchDay.toISOString().slice(0, 10)),
        );
        const slotStarts = daySlots.map((slot) => slot.startTime);

        expect(slotStarts).not.toContain(completedMatchStart.toISOString());
    });
});
