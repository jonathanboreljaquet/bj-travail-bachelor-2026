import {
    beforeAll,
    afterEach,
    describe,
    expect,
    it,
    jest,
} from "@jest/globals";
import type { Request, Response } from "express";

const findManyMock =
    jest.fn<(args: Record<string, unknown>) => Promise<unknown[]>>();

const prismaMock = {
    match: {
        findMany: findManyMock,
    },
};

await jest.unstable_mockModule("../../src/db", () => ({
    default: prismaMock,
}));

let getMatches: typeof import("../../src/controllers/match.controller").getMatches;

beforeAll(async () => {
    ({ getMatches } = await import("../../src/controllers/match.controller"));
});

afterEach(() => {
    jest.clearAllMocks();
});

const createMockResponse = () => {
    const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    };

    return response as unknown as Response;
};

const createMockRequest = (query: Record<string, unknown> = {}) =>
    ({
        query,
    }) as Request;

const createMatchOne = () => ({
    id: 101,
    startTime: new Date("2026-04-15T18:00:00.000Z"),
    endTime: new Date("2026-04-15T20:00:00.000Z"),
    status: "OPEN",
    availableSpots: 2,
    equipmentRental: true,
    court: {
        name: "Court Alpha",
        type: "INDOOR",
        hasEquipmentBox: true,
        pricePerPerson: 18,
        slotDuration: 120,
        club: {
            name: "Geneva Club",
            city: "Lancy",
            openingTime: "08:00",
            closingTime: "23:00",
        },
    },
    participants: [
        {
            user: {
                firstname: "Ana",
                lastname: "Martinez",
                email: "ana@test.dev",
                level: 2,
            },
        },
        {
            user: {
                firstname: "Luca",
                lastname: "Rossi",
                email: "luca@test.dev",
                level: 4,
            },
        },
    ],
});

const createMatchTwo = () => ({
    id: 202,
    startTime: new Date("2026-04-16T18:30:00.000Z"),
    endTime: new Date("2026-04-16T20:00:00.000Z"),
    status: "OPEN",
    availableSpots: 1,
    equipmentRental: false,
    court: {
        name: "Court Beta",
        type: "OUTDOOR",
        hasEquipmentBox: false,
        pricePerPerson: 25,
        slotDuration: 90,
        club: {
            name: "Lake Club",
            city: "Geneva",
            openingTime: "09:00",
            closingTime: "22:00",
        },
    },
    participants: [
        {
            user: {
                firstname: "Sofia",
                lastname: "Keller",
                email: "sofia@test.dev",
                level: 5,
            },
        },
        {
            user: {
                firstname: "Noah",
                lastname: "Meyer",
                email: "noah@test.dev",
                level: 6,
            },
        },
        {
            user: {
                firstname: "Mia",
                lastname: "Dubois",
                email: "mia@test.dev",
                level: 5,
            },
        },
    ],
});

const toExpectedMatch = (match: ReturnType<typeof createMatchOne>) => match;

describe("[UNIT TEST] getMatches", () => {
    it("returns all matches when no filter is provided", async () => {
        const matchOne = createMatchOne();
        const matchTwo = createMatchTwo();
        prismaMock.match.findMany.mockResolvedValueOnce([matchOne, matchTwo]);

        const request = createMockRequest();
        const response = createMockResponse();

        await getMatches(request, response);

        expect(prismaMock.match.findMany).toHaveBeenCalledWith({
            where: {
                status: "OPEN",
                availableSpots: {
                    gt: 0,
                },
            },
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

        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith([
            toExpectedMatch(matchOne),
            toExpectedMatch(matchTwo),
        ]);
    });

    it("returns one match when query parameters are provided", async () => {
        const matchOne = createMatchOne();
        prismaMock.match.findMany.mockResolvedValueOnce([matchOne]);

        const request = createMockRequest({
            city: "Lancy",
            hasEquipmentBox: "true",
            minPricePerPerson: "10",
            maxPricePerPerson: "20",
            slotDuration: "120",
            availableSpots: "2",
        });
        const response = createMockResponse();

        await getMatches(request, response);

        expect(prismaMock.match.findMany).toHaveBeenCalledWith({
            where: {
                status: "OPEN",
                availableSpots: {
                    gt: 0,
                    equals: 2,
                },
                court: {
                    club: {
                        city: {
                            equals: "Lancy",
                        },
                    },
                    hasEquipmentBox: true,
                    pricePerPerson: {
                        gte: 10,
                        lte: 20,
                    },
                    slotDuration: {
                        equals: 120,
                    },
                },
            },
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

        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith([toExpectedMatch(matchOne)]);
    });

    it("returns the correct match when the level average filter is provided", async () => {
        const matchOne = createMatchOne();
        const matchTwo = createMatchTwo();
        prismaMock.match.findMany.mockResolvedValueOnce([matchOne, matchTwo]);

        const request = createMockRequest({
            participantAverageLevel: "5",
            participantAverageLevelTolerance: "0.5",
        });
        const response = createMockResponse();

        await getMatches(request, response);

        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith([toExpectedMatch(matchTwo)]);
    });

    it("returns no matches when the level average filter is provided but no matches are found", async () => {
        const matchOne = createMatchOne();
        const matchTwo = createMatchTwo();
        prismaMock.match.findMany.mockResolvedValueOnce([matchOne, matchTwo]);

        const request = createMockRequest({
            participantAverageLevel: "4",
            participantAverageLevelTolerance: "0.25",
        });
        const response = createMockResponse();

        await getMatches(request, response);

        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith([]);
    });

    it("returns matches with 2 participants when availableSpots is 2", async () => {
        const matchOne = createMatchOne();
        prismaMock.match.findMany.mockResolvedValueOnce([matchOne]);

        const request = createMockRequest({
            availableSpots: "2",
        });
        const response = createMockResponse();

        await getMatches(request, response);

        expect(prismaMock.match.findMany).toHaveBeenCalledWith({
            where: {
                status: "OPEN",
                availableSpots: {
                    gt: 0,
                    equals: 2,
                },
            },
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

        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith([toExpectedMatch(matchOne)]);

        const responsePayload = (response.json as jest.Mock).mock
            .calls[0][0] as any[];
        expect(responsePayload[0].participants).toHaveLength(2);
    });

    it("returns a 500 response when Prisma fails", async () => {
        prismaMock.match.findMany.mockRejectedValueOnce(
            new Error("database unavailable"),
        );

        const request = createMockRequest();
        const response = createMockResponse();

        await getMatches(request, response);

        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith({
            message: "Error while fetching matches",
        });
    });
});
