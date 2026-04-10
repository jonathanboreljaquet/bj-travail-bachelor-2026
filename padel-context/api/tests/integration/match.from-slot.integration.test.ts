import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import bcrypt from "bcryptjs";

import app from "../../src/app";
import prisma from "../../src/db";

const uniquePrefix = `match-from-slot-integration-${Date.now()}`;

const createdClubIds: number[] = [];
const createdCourtIds: number[] = [];
const createdMatchIds: number[] = [];
const createdUserIds: number[] = [];

const createUser = async (suffix: string) => {
    const user = await prisma.user.create({
        data: {
            firstname: `${uniquePrefix}-${suffix}`,
            lastname: "User",
            email: `${uniquePrefix}-${suffix}@test.dev`,
            password: await bcrypt.hash("password123", 10),
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
    openingTime,
    closingTime,
    slotDuration,
}: {
    clubName: string;
    city: string;
    courtName: string;
    openingTime: string;
    closingTime: string;
    slotDuration: number;
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
            type: "OUTDOOR",
            hasEquipmentBox: true,
            pricePerPerson: 15,
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

const getAuthToken = async (email: string, password: string) => {
    const response = await request(app).post("/api/auth/login").send({
        email,
        password,
    });

    return response.body.token as string;
};

describe("[INTEGRATION TEST] POST /api/matches/from-slot", () => {
    let creator: { id: number; email: string };
    let secondUser: { id: number; email: string };
    let court: { id: number };
    let token: string;

    beforeAll(async () => {
        creator = await createUser("creator");
        secondUser = await createUser("second-user");

        court = await createCourtWithClub({
            clubName: "main-club",
            city: `${uniquePrefix}-Geneva`,
            courtName: "main-court",
            openingTime: "08:00",
            closingTime: "22:00",
            slotDuration: 60,
        });

        token = await getAuthToken(creator.email, "password123");
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

    it("returns 401 when user is not authenticated", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 1);
        startTime.setUTCHours(9, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCHours(10, 0, 0, 0);

        const response = await request(app).post("/api/matches/from-slot").send({
            courtId: court.id,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
        });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe(
            "missing or invalid authorization header",
        );
    });

    it("returns 400 when required fields are missing", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 1);
        startTime.setUTCHours(9, 0, 0, 0);

        const response = await request(app)
            .post("/api/matches/from-slot")
            .set("Authorization", `Bearer ${token}`)
            .send({
                courtId: court.id,
                startTime: startTime.toISOString(),
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "courtId, startTime and endTime are required",
        );
    });

    it("returns 404 when court does not exist", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 1);
        startTime.setUTCHours(9, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCHours(10, 0, 0, 0);

        const response = await request(app)
            .post("/api/matches/from-slot")
            .set("Authorization", `Bearer ${token}`)
            .send({
                courtId: 999999,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe("court not found");
    });

    it("returns 400 when slot range is invalid", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 1);
        startTime.setUTCHours(9, 0, 0, 0);

        const response = await request(app)
            .post("/api/matches/from-slot")
            .set("Authorization", `Bearer ${token}`)
            .send({
                courtId: court.id,
                startTime: startTime.toISOString(),
                endTime: startTime.toISOString(),
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("invalid slot range");
    });

    it("returns 400 when slot is not aligned with court slotDuration", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 1);
        startTime.setUTCHours(9, 30, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCHours(10, 30, 0, 0);

        const response = await request(app)
            .post("/api/matches/from-slot")
            .set("Authorization", `Bearer ${token}`)
            .send({
                courtId: court.id,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "slot is not aligned with court slotDuration",
        );
    });

    it("returns 400 when slot duration does not match court slotDuration", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 1);
        startTime.setUTCHours(9, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCHours(11, 0, 0, 0);

        const response = await request(app)
            .post("/api/matches/from-slot")
            .set("Authorization", `Bearer ${token}`)
            .send({
                courtId: court.id,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "slot duration does not match court slotDuration",
        );
    });

    it("returns 400 when slot is outside club opening hours", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 1);
        startTime.setUTCHours(7, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCHours(8, 0, 0, 0);

        const response = await request(app)
            .post("/api/matches/from-slot")
            .set("Authorization", `Bearer ${token}`)
            .send({
                courtId: court.id,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "slot is outside club opening hours",
        );
    });

    it("returns 400 when slot is outside the next 7 days", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 10);
        startTime.setUTCHours(9, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCHours(10, 0, 0, 0);

        const response = await request(app)
            .post("/api/matches/from-slot")
            .set("Authorization", `Bearer ${token}`)
            .send({
                courtId: court.id,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "slot must be within the next 7 days",
        );
    });

    it("returns 409 when slot overlaps with OPEN match", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 1);
        startTime.setUTCHours(11, 0, 0, 0);

        await createMatch({
            courtId: court.id,
            creatorId: secondUser.id,
            startTime,
            durationMinutes: 60,
            status: "OPEN",
            availableSpots: 2,
        });

        const endTime = new Date(startTime);
        endTime.setUTCHours(12, 0, 0, 0);

        const response = await request(app)
            .post("/api/matches/from-slot")
            .set("Authorization", `Bearer ${token}`)
            .send({
                courtId: court.id,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe("slot is no longer available");
    });

    it("returns 409 when slot overlaps with COMPLETED match", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 1);
        startTime.setUTCHours(17, 0, 0, 0);

        await createMatch({
            courtId: court.id,
            creatorId: secondUser.id,
            startTime,
            durationMinutes: 60,
            status: "COMPLETED",
            availableSpots: 0,
        });

        const endTime = new Date(startTime);
        endTime.setUTCHours(18, 0, 0, 0);

        const response = await request(app)
            .post("/api/matches/from-slot")
            .set("Authorization", `Bearer ${token}`)
            .send({
                courtId: court.id,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe("slot is no longer available");
    });

    it("returns 201 and creates a match with creator as participant", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 2);
        startTime.setUTCHours(13, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCHours(14, 0, 0, 0);

        const response = await request(app)
            .post("/api/matches/from-slot")
            .set("Authorization", `Bearer ${token}`)
            .send({
                courtId: court.id,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe("match created from slot");
        expect(response.body.match).toBeDefined();
        expect(response.body.match.status).toBe("OPEN");
        expect(response.body.match.availableSpots).toBe(3);
        expect(response.body.match.creator_id).toBe(creator.id);
        expect(response.body.match.participants.length).toBe(1);
        expect(response.body.match.participants[0].user.id).toBe(creator.id);

        createdMatchIds.push(response.body.match.id as number);
    });

    it("returns 201 when overlapping match is CANCELED", async () => {
        const startTime = new Date();
        startTime.setUTCDate(startTime.getUTCDate() + 3);
        startTime.setUTCHours(15, 0, 0, 0);

        await createMatch({
            courtId: court.id,
            creatorId: secondUser.id,
            startTime,
            durationMinutes: 60,
            status: "CANCELED",
            availableSpots: 2,
        });

        const endTime = new Date(startTime);
        endTime.setUTCHours(16, 0, 0, 0);

        const response = await request(app)
            .post("/api/matches/from-slot")
            .set("Authorization", `Bearer ${token}`)
            .send({
                courtId: court.id,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe("match created from slot");
        expect(response.body.match.id).toBeDefined();

        createdMatchIds.push(response.body.match.id as number);
    });
});
