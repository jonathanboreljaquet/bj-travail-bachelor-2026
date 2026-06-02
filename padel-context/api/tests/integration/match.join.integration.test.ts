import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import bcrypt from "bcryptjs";

import app from "../../src/app";
import prisma from "../../src/db";
import { MAX_UPCOMING_MATCHES } from "../../src/utils/helper";

const uniquePrefix = `match-join-integration-${Date.now()}`;

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
}: {
    clubName: string;
    city: string;
    courtName: string;
}) => {
    const club = await prisma.club.create({
        data: {
            name: `${uniquePrefix}-${clubName}`,
            city,
            postalCode: "1200",
            openingTime: "08:00",
            closingTime: "23:00",
        },
    });

    createdClubIds.push(club.id);

    const court = await prisma.court.create({
        data: {
            name: `${uniquePrefix}-${courtName}`,
            type: "OUTDOOR",
            hasEquipmentBox: true,
            pricePerPerson: 15,
            slotDuration: 120,
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

describe("[INTEGRATION TEST] POST /api/matches/:matchId/join", () => {
    let creator: { id: number; email: string };
    let joiner1: { id: number; email: string };
    let joiner2: { id: number; email: string };
    let joiner3: { id: number; email: string };
    let joiner4: { id: number; email: string };
    let court: { id: number };
    let token1: string;
    let token2: string;
    let token3: string;
    let token4: string;

    beforeAll(async () => {
        creator = await createUser("creator");
        joiner1 = await createUser("joiner1");
        joiner2 = await createUser("joiner2");
        joiner3 = await createUser("joiner3");
        joiner4 = await createUser("joiner4");

        court = await createCourtWithClub({
            clubName: "test-club",
            city: `${uniquePrefix}-Geneva`,
            courtName: "test-court",
        });

        token1 = await getAuthToken(joiner1.email, "password123");
        token2 = await getAuthToken(joiner2.email, "password123");
        token3 = await getAuthToken(joiner3.email, "password123");
        token4 = await getAuthToken(joiner4.email, "password123");
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
        const matchStartTime = new Date();
        matchStartTime.setUTCDate(matchStartTime.getUTCDate() + 2);
        matchStartTime.setUTCHours(18, 0, 0, 0);

        const match = await createMatch({
            courtId: court.id,
            creatorId: creator.id,
            startTime: matchStartTime,
            durationMinutes: 90,
            status: "OPEN",
            availableSpots: 2,
        });

        const response = await request(app)
            .post(`/api/matches/${match.id}/join`)
            .send({});

        expect(response.status).toBe(401);
        expect(response.body.message).toBe(
            "missing or invalid authorization header",
        );
    });

    it("returns 404 when match does not exist", async () => {
        const response = await request(app)
            .post("/api/matches/99999/join")
            .set("Authorization", `Bearer ${token1}`);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe("match not found");
    });

    it("returns 400 when match is not OPEN", async () => {
        const matchStartTime = new Date();
        matchStartTime.setUTCDate(matchStartTime.getUTCDate() + 2);
        matchStartTime.setUTCHours(18, 0, 0, 0);

        const match = await createMatch({
            courtId: court.id,
            creatorId: creator.id,
            startTime: matchStartTime,
            durationMinutes: 90,
            status: "COMPLETED",
            availableSpots: 2,
        });

        const response = await request(app)
            .post(`/api/matches/${match.id}/join`)
            .set("Authorization", `Bearer ${token1}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("match is not open");
    });

    it("returns 400 when no available spots", async () => {
        const matchStartTime = new Date();
        matchStartTime.setUTCDate(matchStartTime.getUTCDate() + 2);
        matchStartTime.setUTCHours(18, 0, 0, 0);

        const match = await createMatch({
            courtId: court.id,
            creatorId: creator.id,
            startTime: matchStartTime,
            durationMinutes: 90,
            status: "OPEN",
            availableSpots: 0,
        });

        const response = await request(app)
            .post(`/api/matches/${match.id}/join`)
            .set("Authorization", `Bearer ${token1}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("no available spots");
    });

    it("returns 400 when user already joined the match", async () => {
        const matchStartTime = new Date();
        matchStartTime.setUTCDate(matchStartTime.getUTCDate() + 2);
        matchStartTime.setUTCHours(18, 0, 0, 0);

        const match = await createMatch({
            courtId: court.id,
            creatorId: creator.id,
            startTime: matchStartTime,
            durationMinutes: 90,
            status: "OPEN",
            availableSpots: 2,
        });

        await request(app)
            .post(`/api/matches/${match.id}/join`)
            .set("Authorization", `Bearer ${token1}`);

        const response = await request(app)
            .post(`/api/matches/${match.id}/join`)
            .set("Authorization", `Bearer ${token1}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("user already joined this match");
    });

    it("returns 200 when user successfully joins match and decrements availableSpots", async () => {
        const matchStartTime = new Date();
        matchStartTime.setUTCDate(matchStartTime.getUTCDate() + 2);
        matchStartTime.setUTCHours(18, 0, 0, 0);

        const match = await createMatch({
            courtId: court.id,
            creatorId: creator.id,
            startTime: matchStartTime,
            durationMinutes: 90,
            status: "OPEN",
            availableSpots: 3,
        });

        const response = await request(app)
            .post(`/api/matches/${match.id}/join`)
            .set("Authorization", `Bearer ${token1}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("successfully joined match");
        expect(response.body.match).toBeDefined();
        expect(response.body.match.availableSpots).toBe(2);
        expect(response.body.match.status).toBe("OPEN");
        expect(response.body.match.participants.length).toBe(1);
        expect(response.body.match.participants[0].user.id).toBe(joiner1.id);
    });

    it("returns 200 and changes match status to COMPLETED when last spot is filled", async () => {
        const matchStartTime = new Date();
        matchStartTime.setUTCDate(matchStartTime.getUTCDate() + 2);
        matchStartTime.setUTCHours(19, 0, 0, 0);

        const match = await createMatch({
            courtId: court.id,
            creatorId: creator.id,
            startTime: matchStartTime,
            durationMinutes: 90,
            status: "OPEN",
            availableSpots: 1,
        });

        const response = await request(app)
            .post(`/api/matches/${match.id}/join`)
            .set("Authorization", `Bearer ${token2}`);

        expect(response.status).toBe(200);
        expect(response.body.match.availableSpots).toBe(0);
        expect(response.body.match.status).toBe("COMPLETED");
    });

    it("returns 200 and handles multiple users joining sequentially", async () => {
        const matchStartTime = new Date();
        matchStartTime.setUTCDate(matchStartTime.getUTCDate() + 2);
        matchStartTime.setUTCHours(20, 0, 0, 0);

        const match = await createMatch({
            courtId: court.id,
            creatorId: creator.id,
            startTime: matchStartTime,
            durationMinutes: 90,
            status: "OPEN",
            availableSpots: 3,
        });

        const response1 = await request(app)
            .post(`/api/matches/${match.id}/join`)
            .set("Authorization", `Bearer ${token1}`);

        expect(response1.status).toBe(200);
        expect(response1.body.match.availableSpots).toBe(2);
        expect(response1.body.match.status).toBe("OPEN");

        const response2 = await request(app)
            .post(`/api/matches/${match.id}/join`)
            .set("Authorization", `Bearer ${token2}`);

        expect(response2.status).toBe(200);
        expect(response2.body.match.availableSpots).toBe(1);
        expect(response2.body.match.status).toBe("OPEN");

        const response3 = await request(app)
            .post(`/api/matches/${match.id}/join`)
            .set("Authorization", `Bearer ${token3}`);

        expect(response3.status).toBe(200);
        expect(response3.body.match.availableSpots).toBe(0);
        expect(response3.body.match.status).toBe("COMPLETED");
        expect(response3.body.match.participants.length).toBe(3);
    });

    it("returns 200 and includes participant details in response", async () => {
        const matchStartTime = new Date();
        matchStartTime.setUTCDate(matchStartTime.getUTCDate() + 2);
        matchStartTime.setUTCHours(21, 0, 0, 0);

        const match = await createMatch({
            courtId: court.id,
            creatorId: creator.id,
            startTime: matchStartTime,
            durationMinutes: 90,
            status: "OPEN",
            availableSpots: 2,
        });

        const response = await request(app)
            .post(`/api/matches/${match.id}/join`)
            .set("Authorization", `Bearer ${token4}`);

        expect(response.status).toBe(200);
        expect(response.body.match.participants).toBeDefined();
        expect(response.body.match.participants.length).toBe(1);

        const participant = response.body.match.participants[0];
        expect(participant.user.id).toBe(joiner4.id);
        expect(participant.user.firstname).toBeDefined();
        expect(participant.user.lastname).toBeDefined();
        expect(participant.user.email).toBeDefined();
        expect(participant.user.level).toBeDefined();
        expect(participant.joinedAt).toBeDefined();
    });

    it("returns 403 when the user already joined 5 future matches", async () => {
        const limitUser = await createUser("limit-user");
        const limitToken = await getAuthToken(limitUser.email, "password123");

        for (let index = 0; index < MAX_UPCOMING_MATCHES; index += 1) {
            const matchStartTime = new Date();
            matchStartTime.setUTCDate(matchStartTime.getUTCDate() + 3 + index);
            matchStartTime.setUTCHours(18, 0, 0, 0);

            const match = await createMatch({
                courtId: court.id,
                creatorId: creator.id,
                startTime: matchStartTime,
                durationMinutes: 90,
                status: "OPEN",
                availableSpots: 2,
            });

            const response = await request(app)
                .post(`/api/matches/${match.id}/join`)
                .set("Authorization", `Bearer ${limitToken}`);

            expect(response.status).toBe(200);
        }

        const sixthMatchStartTime = new Date();
        sixthMatchStartTime.setUTCDate(sixthMatchStartTime.getUTCDate() + 9);
        sixthMatchStartTime.setUTCHours(18, 0, 0, 0);

        const sixthMatch = await createMatch({
            courtId: court.id,
            creatorId: creator.id,
            startTime: sixthMatchStartTime,
            durationMinutes: 90,
            status: "OPEN",
            availableSpots: 2,
        });

        const response = await request(app)
            .post(`/api/matches/${sixthMatch.id}/join`)
            .set("Authorization", `Bearer ${limitToken}`);

        expect(response.status).toBe(403);
    });
});
