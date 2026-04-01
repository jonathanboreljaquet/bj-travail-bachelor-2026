import request from "supertest";
import { describe, it, expect, afterAll, beforeAll } from "@jest/globals";

import app from "../../src/app";
import prisma from "../../src/db";

describe("[INTEGRATION TEST] GET /api/matches (query-based)", () => {
    const uniquePrefix = `mcp-query-${Date.now()}`;

    let createdClubId: number;
    let createdCourtId: number;
    let createdMatchId: number;
    let createdUserIds: number[] = [];
    let scenarioStartTimeIso: string;
    let scenarioEndTimeIso: string;

    beforeAll(async () => {
        const creator = await prisma.user.create({
            data: {
                firstname: "Scenario",
                lastname: "Creator",
                email: `${uniquePrefix}-creator@test.dev`,
                password: "password123",
                level: 3,
            },
        });

        const participantOne = await prisma.user.create({
            data: {
                firstname: "Scenario",
                lastname: "P1",
                email: `${uniquePrefix}-p1@test.dev`,
                password: "password123",
                level: 2,
            },
        });

        const participantTwo = await prisma.user.create({
            data: {
                firstname: "Scenario",
                lastname: "P2",
                email: `${uniquePrefix}-p2@test.dev`,
                password: "password123",
                level: 4,
            },
        });

        createdUserIds = [creator.id, participantOne.id, participantTwo.id];

        const club = await prisma.club.create({
            data: {
                name: `${uniquePrefix}-club`,
                city: "Lancy",
                openingTime: "08:00",
                closingTime: "23:00",
            },
        });

        createdClubId = club.id;

        const court = await prisma.court.create({
            data: {
                name: `${uniquePrefix}-court`,
                type: "INDOOR",
                hasEquipmentBox: true,
                pricePerPerson: 15,
                slotDuration: 120,
                club_id: club.id,
            },
        });

        createdCourtId = court.id;

        const startTime = new Date();
        startTime.setDate(startTime.getDate() + 2);
        startTime.setHours(18, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + 120);

        scenarioStartTimeIso = startTime.toISOString();
        scenarioEndTimeIso = endTime.toISOString();

        const match = await prisma.match.create({
            data: {
                startTime,
                endTime,
                status: "OPEN",
                availableSpots: 2,
                equipmentRental: true,
                court_id: court.id,
                creator_id: creator.id,
            },
        });

        createdMatchId = match.id;

        await prisma.participant.createMany({
            data: [
                { user_id: participantOne.id, match_id: match.id },
                { user_id: participantTwo.id, match_id: match.id },
            ],
        });
    });

    afterAll(async () => {
        await prisma.participant.deleteMany({
            where: {
                match_id: createdMatchId,
            },
        });

        await prisma.match.deleteMany({
            where: {
                id: createdMatchId,
            },
        });

        await prisma.court.deleteMany({
            where: {
                id: createdCourtId,
            },
        });

        await prisma.club.deleteMany({
            where: {
                id: createdClubId,
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

    it("returns HTTP code 200 for query-based endpoint", async () => {
        const response = await request(app).get("/api/matches");

        expect(response.status).toBe(200);
    });

    it("returns matches filtered with complete MCP criteria", async () => {
        const response = await request(app).get("/api/matches").query({
            status: "OPEN",
            city: "Lancy",
            hasEquipmentBox: "true",
            maxPricePerPerson: "15",
            slotDuration: "120",
            minAvailableSpots: "2",
            participantAverageLevel: "3",
            participantAverageLevelTolerance: "0.1",
            startTimeFrom: scenarioStartTimeIso,
            endTimeTo: scenarioEndTimeIso,
            include: "participants,club,court",
        });

        const matches = response.body as any[];

        expect(response.status).toBe(200);
        expect(Array.isArray(matches)).toBe(true);
        expect(matches.length).toBeGreaterThan(0);
        expect(matches.some((match: any) => match.id === createdMatchId)).toBe(
            true,
        );

        matches.forEach((match: any) => {
            //Match informations
            expect(match).toHaveProperty("id");
            expect(match).toHaveProperty("startTime");
            expect(match).toHaveProperty("endTime");
            expect(match).toHaveProperty("status", "OPEN");
            expect(match).toHaveProperty("availableSpots");
            expect(match.availableSpots).toBeGreaterThanOrEqual(2);
            //Club informations (nested in court)
            expect(match).toHaveProperty("court");
            expect(match.court).toHaveProperty("club");
            expect(match.court.club).toHaveProperty("name");
            expect(match.court.club).toHaveProperty("city", "Lancy");
            expect(match.court.club).toHaveProperty("openingTime");
            expect(match.court.club).toHaveProperty("closingTime");
            //Court informations
            expect(match).toHaveProperty("court");
            expect(match.court).toHaveProperty("name");
            expect(match.court).toHaveProperty("type");
            expect(match.court).toHaveProperty("hasEquipmentBox", true);
            expect(match.court).toHaveProperty("pricePerPerson");
            expect(match.court.pricePerPerson).toBeLessThanOrEqual(15);
            expect(match.court).toHaveProperty("slotDuration", 120);
            //Participants informations
            expect(match).toHaveProperty("participants");
            expect(Array.isArray(match.participants)).toBe(true);
            expect(match.participants.length).toBeGreaterThan(0);

            const averageLevel =
                match.participants.reduce(
                    (accumulator: number, participant: any) =>
                        accumulator + participant.user.level,
                    0,
                ) / match.participants.length;
            expect(averageLevel).toBeCloseTo(3, 1);

            match.participants.forEach((participant: any) => {
                expect(participant).toHaveProperty("user");
                expect(participant.user).toHaveProperty("firstname");
                expect(participant.user).toHaveProperty("lastname");
                expect(participant.user).toHaveProperty("email");
                expect(participant.user).toHaveProperty("level");
                expect(participant.user).not.toHaveProperty("id");
                expect(participant.user).not.toHaveProperty("password");
                expect(participant.user).not.toHaveProperty("createdAt");
            });
        });
    });
});
