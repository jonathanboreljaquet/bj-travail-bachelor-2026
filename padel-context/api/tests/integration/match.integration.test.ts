import request from "supertest";
import { describe, it, expect, afterAll, beforeAll } from "@jest/globals";

import app from "../../src/app";
import prisma from "../../src/db";

describe("[INTEGRATION TEST] GET /api/matches", () => {
    const uniquePrefix = `integration-test-${Date.now()}`;

    let createdClubIds: number[] = [];
    let createdCourtIds: number[] = [];
    let createdMatchIds: number[] = [];
    let createdUserIds: number[] = [];
    let matchOneStartTimeIso: string;
    let matchOneEndTimeIso: string;
    let matchOneId: number;
    let matchOneCity: string;
    let matchTwoId: number;
    let matchTwoCity: string;
    let matchTwoStartTimeIso: string;
    let matchTwoEndTimeIso: string;

    const createUser = async ({
        suffix,
        firstname,
        lastname,
        level,
    }: {
        suffix: string;
        firstname: string;
        lastname: string;
        level: number;
    }) => {
        const user = await prisma.user.create({
            data: {
                firstname,
                lastname,
                email: `${uniquePrefix}-${suffix}@test.dev`,
                password: "password123",
                level,
            },
        });

        createdUserIds.push(user.id);
        return user;
    };

    const createMatchScenario = async ({
        clubName,
        city,
        courtName,
        type,
        hasEquipmentBox,
        pricePerPerson,
        slotDuration,
        status,
        availableSpots,
        startTime,
        durationMinutes,
        participantIds,
        creatorId,
    }: {
        clubName: string;
        city: string;
        courtName: string;
        type: "INDOOR" | "OUTDOOR";
        hasEquipmentBox: boolean;
        pricePerPerson: number;
        slotDuration: number;
        status: "OPEN" | "COMPLETED" | "CANCELED";
        availableSpots: number;
        startTime: Date;
        durationMinutes: number;
        participantIds: number[];
        creatorId: number;
    }) => {
        const club = await prisma.club.create({
            data: {
                name: `${uniquePrefix}-${clubName}`,
                city,
                openingTime: "08:00",
                closingTime: "23:00",
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

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + durationMinutes);

        const match = await prisma.match.create({
            data: {
                startTime,
                endTime,
                status,
                availableSpots,
                court_id: court.id,
                creator_id: creatorId,
            },
        });

        createdMatchIds.push(match.id);

        await prisma.participant.createMany({
            data: participantIds.map((userId) => ({
                user_id: userId,
                match_id: match.id,
            })),
        });

        return {
            matchId: match.id,
            startTime,
            endTime,
            city,
            hasEquipmentBox,
            pricePerPerson,
            slotDuration,
            availableSpots,
        };
    };

    beforeAll(async () => {
        const creator = await createUser({
            suffix: "creator",
            firstname: "Scenario",
            lastname: "Creator",
            level: 3,
        });

        const participantOne = await createUser({
            suffix: "p1",
            firstname: "Scenario",
            lastname: "P1",
            level: 2,
        });

        const participantTwo = await createUser({
            suffix: "p2",
            firstname: "Scenario",
            lastname: "P2",
            level: 4,
        });

        const participantThree = await createUser({
            suffix: "p3",
            firstname: "Scenario",
            lastname: "P3",
            level: 5,
        });

        const participantFour = await createUser({
            suffix: "p4",
            firstname: "Scenario",
            lastname: "P4",
            level: 6,
        });

        const participantFive = await createUser({
            suffix: "p5",
            firstname: "Scenario",
            lastname: "P5",
            level: 5,
        });

        const matchOneStartTime = new Date();
        matchOneStartTime.setDate(matchOneStartTime.getDate() + 2);
        matchOneStartTime.setHours(18, 0, 0, 0);

        const matchTwoStartTime = new Date();
        matchTwoStartTime.setDate(matchTwoStartTime.getDate() + 3);
        matchTwoStartTime.setHours(18, 30, 0, 0);

        const matchOne = await createMatchScenario({
            clubName: "club-1",
            city: `Lancy-${uniquePrefix}`,
            courtName: "court-1",
            type: "INDOOR",
            hasEquipmentBox: true,
            pricePerPerson: 15,
            slotDuration: 120,
            status: "OPEN",
            availableSpots: 2,
            startTime: matchOneStartTime,
            durationMinutes: 120,
            participantIds: [participantOne.id, participantTwo.id],
            creatorId: creator.id,
        });

        const matchTwo = await createMatchScenario({
            clubName: "club-2",
            city: `Geneva-${uniquePrefix}`,
            courtName: "court-2",
            type: "OUTDOOR",
            hasEquipmentBox: false,
            pricePerPerson: 25,
            slotDuration: 90,
            status: "OPEN",
            availableSpots: 1,
            startTime: matchTwoStartTime,
            durationMinutes: 90,
            participantIds: [
                participantThree.id,
                participantFour.id,
                participantFive.id,
            ],
            creatorId: creator.id,
        });

        matchOneId = matchOne.matchId;
        matchTwoId = matchTwo.matchId;
        matchOneCity = matchOne.city;
        matchTwoCity = matchTwo.city;
        matchOneStartTimeIso = matchOne.startTime.toISOString();
        matchOneEndTimeIso = matchOne.endTime.toISOString();
        matchTwoStartTimeIso = matchTwo.startTime.toISOString();
        matchTwoEndTimeIso = matchTwo.endTime.toISOString();
    });

    afterAll(async () => {
        await prisma.participant.deleteMany({
            where: {
                match_id: {
                    in: createdMatchIds,
                },
            },
        });

        await prisma.match.deleteMany({
            where: {
                id: {
                    in: createdMatchIds,
                },
            },
        });

        await prisma.court.deleteMany({
            where: {
                id: {
                    in: createdCourtIds,
                },
            },
        });

        await prisma.club.deleteMany({
            where: {
                id: {
                    in: createdClubIds,
                },
            },
        });

        await prisma.user.deleteMany({
            where: {
                id: {
                    in: createdUserIds,
                },
            },
        });

        await prisma.$disconnect();
    });

    it("returns HTTP code 200", async () => {
        const response = await request(app).get("/api/matches");

        expect(response.status).toBe(200);
    });

    it("returns both matches when no filter is provided", async () => {
        const response = await request(app).get("/api/matches");
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches.length).toBeGreaterThanOrEqual(2);
        expect(matches.map((match) => match.id)).toEqual(
            expect.arrayContaining([matchOneId, matchTwoId]),
        );
    });

    it("returns both matches when status is OPEN", async () => {
        const response = await request(app).get("/api/matches").query({
            status: "open",
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches.length).toBeGreaterThanOrEqual(2);
        expect(matches.map((match) => match.id)).toEqual(
            expect.arrayContaining([matchOneId, matchTwoId]),
        );
    });

    it("returns only the first match when city matches it", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchOneCity,
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchOneId);
        expect(matches[0].court.club.city).toBe(matchOneCity);
    });

    it("returns only the second match when minPricePerPerson is 20", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchTwoCity,
            minPricePerPerson: "20",
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchTwoId);
        expect(matches[0].court.pricePerPerson).toBeGreaterThanOrEqual(20);
    });

    it("returns only the first match when hasEquipmentBox is true", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchOneCity,
            hasEquipmentBox: "true",
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchOneId);
        expect(matches[0].court.hasEquipmentBox).toBe(true);
    });

    it("returns only the first match when minSlotDuration is 100", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchOneCity,
            minSlotDuration: "100",
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchOneId);
        expect(matches[0].court.slotDuration).toBeGreaterThanOrEqual(100);
    });

    it("returns only the second match when maxSlotDuration is 100", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchTwoCity,
            maxSlotDuration: "100",
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchTwoId);
        expect(matches[0].court.slotDuration).toBeLessThanOrEqual(100);
    });

    it("returns only the first match when maxPricePerPerson is 15", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchOneCity,
            maxPricePerPerson: "15",
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchOneId);
        expect(matches[0].court.pricePerPerson).toBeLessThanOrEqual(15);
    });

    it("returns only the first match when availableSpots is 2", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchOneCity,
            availableSpots: "2",
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchOneId);
        expect(matches[0].availableSpots).toBe(2);
    });

    it("returns only the first match when slotDuration is 120", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchOneCity,
            slotDuration: "120",
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchOneId);
        expect(matches[0].court.slotDuration).toBe(120);
    });

    it("returns only the second match when startTimeFrom matches it", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchTwoCity,
            startTimeFrom: matchTwoStartTimeIso,
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchTwoId);
    });

    it("returns only the first match when startTimeTo matches it", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchOneCity,
            startTimeTo: matchOneStartTimeIso,
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchOneId);
    });

    it("returns only the second match when endTimeFrom matches it", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchTwoCity,
            endTimeFrom: matchTwoStartTimeIso,
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchTwoId);
    });

    it("returns only the first match when endTimeTo matches it", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchOneCity,
            endTimeTo: matchOneEndTimeIso,
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchOneId);
    });

    it("returns only the first match with minAvailableSpots 2", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchOneCity,
            minAvailableSpots: "2",
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchOneId);
        expect(matches[0].availableSpots).toBeGreaterThanOrEqual(2);
    });

    it("returns only the first match with participant average level 3 and tolerance 0.1", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchOneCity,
            participantAverageLevel: "3",
            participantAverageLevelTolerance: "0.1",
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchOneId);
    });

    it("returns only the second match with participant average level 5.33 and tolerance 0.1", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchTwoCity,
            participantAverageLevel: "5.33",
            participantAverageLevelTolerance: "0.1",
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchTwoId);
    });

    it("returns only the first match when the full query matches it", async () => {
        const response = await request(app).get("/api/matches").query({
            city: matchOneCity,
            hasEquipmentBox: "true",
            maxPricePerPerson: "15",
            slotDuration: "120",
            minAvailableSpots: "2",
            participantAverageLevel: "3",
            participantAverageLevelTolerance: "0.1",
            startTimeFrom: matchOneStartTimeIso,
            endTimeTo: matchOneEndTimeIso,
        });
        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(matchOneId);
        expect(matches[0].court.club.city).toBe(matchOneCity);
        expect(matches[0].court.hasEquipmentBox).toBe(true);
        expect(matches[0].court.pricePerPerson).toBeLessThanOrEqual(15);
        expect(matches[0].court.slotDuration).toBe(120);
    });
});
