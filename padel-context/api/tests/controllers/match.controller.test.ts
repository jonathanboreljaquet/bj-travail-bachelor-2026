import {
    beforeAll,
    beforeEach,
    afterEach,
    describe,
    expect,
    it,
    jest,
} from "@jest/globals";
import type { Request, Response } from "express";

const findManyMock =
    jest.fn<(args: Record<string, unknown>) => Promise<unknown[]>>();
const findUniqueMock =
    jest.fn<(args: Record<string, unknown>) => Promise<unknown | null>>();
const updateMock =
    jest.fn<(args: Record<string, unknown>) => Promise<unknown>>();
const participantFindUniqueMock =
    jest.fn<(args: Record<string, unknown>) => Promise<unknown | null>>();
const participantCreateMock =
    jest.fn<(args: Record<string, unknown>) => Promise<unknown>>();
const transactionMock = jest.fn<
    (
        callback: (tx: {
            participant: {
                create: typeof participantCreateMock;
            };
            match: {
                update: typeof updateMock;
            };
        }) => Promise<unknown>,
    ) => Promise<unknown>
>();

const prismaMock = {
    match: {
        findMany: findManyMock,
        findUnique: findUniqueMock,
        update: updateMock,
    },
    participant: {
        findUnique: participantFindUniqueMock,
        create: participantCreateMock,
    },
    $transaction: transactionMock,
};

await jest.unstable_mockModule("../../src/db", () => ({
    default: prismaMock,
}));

let getMatches: typeof import("../../src/controllers/match.controller").getMatches;
let joinMatch: typeof import("../../src/controllers/match.controller").joinMatch;

beforeAll(async () => {
    ({ getMatches, joinMatch } =
        await import("../../src/controllers/match.controller"));
});

const mockedNow = new Date("2026-04-10T10:00:00.000Z");

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockedNow);
});

afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
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

const expectedSelect = {
    id: true,
    startTime: true,
    endTime: true,
    status: true,
    availableSpots: true,
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
                    postalCode: true,
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
                    level: true,
                },
            },
        },
    },
};

const buildOpenWhere = (extra: Record<string, unknown> = {}) => ({
    status: "OPEN",
    availableSpots: {
        gt: 0,
    },
    startTime: {
        gte: mockedNow,
    },
    ...extra,
});

const runGetMatchesCase = async ({
    query = {},
    mockMatches,
    expectedWhere,
    expectedResponse = mockMatches,
}: {
    query?: Record<string, unknown>;
    mockMatches: unknown[];
    expectedWhere: Record<string, unknown>;
    expectedResponse?: unknown[];
}) => {
    prismaMock.match.findMany.mockResolvedValueOnce(mockMatches);

    const request = createMockRequest(query);
    const response = createMockResponse();

    await getMatches(request, response);

    expect(prismaMock.match.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        select: expectedSelect,
        take: 30,
        orderBy: { startTime: "asc" },
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(expectedResponse);

    return response;
};

describe("[UNIT TEST] getMatches", () => {
    it("returns all matches when no filter is provided", async () => {
        const matchOne = createMatchOne();
        const matchTwo = createMatchTwo();

        await runGetMatchesCase({
            mockMatches: [matchOne, matchTwo],
            expectedWhere: buildOpenWhere(),
        });
    });

    it("filters matches by city", async () => {
        const matchOne = createMatchOne();

        await runGetMatchesCase({
            query: {
                city: "Lancy",
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                court: {
                    club: {
                        city: {
                            equals: "lancy",
                            mode: "insensitive",
                        },
                    },
                },
            }),
        });
    });

    it("filters matches by hasEquipmentBox", async () => {
        const matchOne = createMatchOne();

        await runGetMatchesCase({
            query: {
                hasEquipmentBox: "true",
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                court: {
                    hasEquipmentBox: true,
                },
            }),
        });
    });

    it("filters matches by minPricePerPerson", async () => {
        const matchOne = createMatchOne();

        await runGetMatchesCase({
            query: {
                minPricePerPerson: "10",
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                court: {
                    pricePerPerson: {
                        gte: 10,
                    },
                },
            }),
        });
    });

    it("filters matches by maxPricePerPerson", async () => {
        const matchOne = createMatchOne();

        await runGetMatchesCase({
            query: {
                maxPricePerPerson: "20",
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                court: {
                    pricePerPerson: {
                        lte: 20,
                    },
                },
            }),
        });
    });

    it("filters matches by slotDuration", async () => {
        const matchOne = createMatchOne();

        await runGetMatchesCase({
            query: {
                slotDuration: "120",
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                court: {
                    slotDuration: {
                        equals: 120,
                    },
                },
            }),
        });
    });

    it("filters matches by minSlotDuration", async () => {
        const matchOne = createMatchOne();

        await runGetMatchesCase({
            query: {
                minSlotDuration: "100",
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                court: {
                    slotDuration: {
                        gte: 100,
                    },
                },
            }),
        });
    });

    it("filters matches by maxSlotDuration", async () => {
        const matchOne = createMatchOne();

        await runGetMatchesCase({
            query: {
                maxSlotDuration: "100",
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                court: {
                    slotDuration: {
                        lte: 100,
                    },
                },
            }),
        });
    });

    it("filters matches by availableSpots", async () => {
        const matchOne = createMatchOne();

        await runGetMatchesCase({
            query: {
                availableSpots: "2",
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                availableSpots: {
                    gt: 0,
                    equals: 2,
                },
            }),
        });
    });

    it("filters matches by minAvailableSpots", async () => {
        const matchOne = createMatchOne();

        await runGetMatchesCase({
            query: {
                minAvailableSpots: "2",
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                availableSpots: {
                    gt: 0,
                    gte: 2,
                },
            }),
        });
    });

    it("filters matches by startTimeFrom", async () => {
        const matchOne = createMatchOne();
        const startTimeFrom = new Date("2026-04-15T00:00:00.000Z");

        await runGetMatchesCase({
            query: {
                startTimeFrom: startTimeFrom.toISOString(),
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                startTime: {
                    gte: startTimeFrom,
                },
            }),
        });
    });

    it("filters matches by startTimeTo", async () => {
        const matchOne = createMatchOne();
        const startTimeTo = new Date("2026-04-16T00:00:00.000Z");

        await runGetMatchesCase({
            query: {
                startTimeTo: startTimeTo.toISOString(),
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                startTime: {
                    gte: mockedNow,
                    lte: startTimeTo,
                },
            }),
        });
    });

    it("filters matches by endTimeFrom", async () => {
        const matchOne = createMatchOne();
        const endTimeFrom = new Date("2026-04-15T19:00:00.000Z");

        await runGetMatchesCase({
            query: {
                endTimeFrom: endTimeFrom.toISOString(),
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                endTime: {
                    gte: endTimeFrom,
                },
            }),
        });
    });

    it("filters matches by endTimeTo", async () => {
        const matchOne = createMatchOne();
        const endTimeTo = new Date("2026-04-15T21:00:00.000Z");

        await runGetMatchesCase({
            query: {
                endTimeTo: endTimeTo.toISOString(),
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                endTime: {
                    lte: endTimeTo,
                },
            }),
        });
    });

    it("filters matches by participantAverageLevel", async () => {
        const matchOne = createMatchOne();
        const matchTwo = createMatchTwo();

        await runGetMatchesCase({
            query: {
                participantAverageLevel: "5",
            },
            mockMatches: [matchOne, matchTwo],
            expectedWhere: buildOpenWhere(),
            expectedResponse: [matchTwo],
        });
    });

    it("filters matches by participantAverageLevelTolerance", async () => {
        const matchOne = createMatchOne();
        const matchTwo = createMatchTwo();

        await runGetMatchesCase({
            query: {
                participantAverageLevel: "5.33",
                participantAverageLevelTolerance: "0.01",
            },
            mockMatches: [matchOne, matchTwo],
            expectedWhere: buildOpenWhere(),
            expectedResponse: [matchTwo],
        });
    });

    it("filters matches by courtType", async () => {
        const matchOne = createMatchOne();

        await runGetMatchesCase({
            query: {
                courtType: "indoor",
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                court: {
                    type: "INDOOR",
                },
            }),
        });
    });

    it("filters matches with all query parameters combined", async () => {
        const matchOne = createMatchOne();
        const matchTwo = createMatchTwo();

        await runGetMatchesCase({
            query: {
                city: "Lancy",
                hasEquipmentBox: "true",
                minPricePerPerson: "10",
                maxPricePerPerson: "20",
                slotDuration: "120",
                minSlotDuration: "100",
                maxSlotDuration: "130",
                availableSpots: "2",
                minAvailableSpots: "2",
                startTimeFrom: matchOne.startTime.toISOString(),
                startTimeTo: matchOne.startTime.toISOString(),
                endTimeFrom: matchOne.endTime.toISOString(),
                endTimeTo: matchOne.endTime.toISOString(),
                participantAverageLevel: "3",
                participantAverageLevelTolerance: "0.1",
                courtType: "INDOOR",
            },
            mockMatches: [matchOne, matchTwo],
            expectedWhere: {
                status: "OPEN",
                availableSpots: {
                    gt: 0,
                    equals: 2,
                    gte: 2,
                },
                startTime: {
                    gte: matchOne.startTime,
                    lte: matchOne.startTime,
                },
                endTime: {
                    gte: matchOne.endTime,
                    lte: matchOne.endTime,
                },
                court: {
                    club: {
                        city: {
                            equals: "lancy",
                            mode: "insensitive",
                        },
                    },
                    hasEquipmentBox: true,
                    pricePerPerson: {
                        gte: 10,
                        lte: 20,
                    },
                    slotDuration: {
                        equals: 120,
                        gte: 100,
                        lte: 130,
                    },
                    type: "INDOOR",
                },
            },
            expectedResponse: [matchOne],
        });
    });

    it("keeps mockedNow when startTimeFrom is in the past", async () => {
        const matchOne = createMatchOne();
        const pastStartTimeFrom = new Date("2026-04-01T00:00:00.000Z");

        await runGetMatchesCase({
            query: {
                startTimeFrom: pastStartTimeFrom.toISOString(),
            },
            mockMatches: [matchOne],
            expectedWhere: buildOpenWhere({
                startTime: {
                    gte: mockedNow,
                },
            }),
        });
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
            error: expect.any(Error),
        });
    });
});

describe("[UNIT TEST] joinMatch", () => {
    const mockAuthUser = { userId: 1, email: "user@test.dev" };

    const createMockRequestForJoin = (matchId: string | number) =>
        ({
            params: { matchId: String(matchId) },
        }) as unknown as Request;

    const createMockResponseWithAuthUser = (
        authUser?: { userId: number; email: string } | null,
    ) => {
        const response = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: {
                authUser: authUser !== null ? authUser : undefined,
            },
        };

        return response as unknown as Response;
    };

    it("returns 400 when matchId is not numeric", async () => {
        const request = createMockRequestForJoin("invalid");
        const response = createMockResponseWithAuthUser(mockAuthUser);

        await joinMatch(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "invalid match ID",
        });
    });

    it("returns 401 when authUser is missing", async () => {
        const request = createMockRequestForJoin(123);
        const response = createMockResponseWithAuthUser(null);

        await joinMatch(request, response);

        expect(response.status).toHaveBeenCalledWith(401);
        expect(response.json).toHaveBeenCalledWith({
            message: "unauthorized",
        });
    });

    it("returns 404 when match is not found", async () => {
        const request = createMockRequestForJoin(999);
        const response = createMockResponseWithAuthUser(mockAuthUser);

        findUniqueMock.mockResolvedValueOnce(null);

        await joinMatch(request, response);

        expect(response.status).toHaveBeenCalledWith(404);
        expect(response.json).toHaveBeenCalledWith({
            message: "match not found",
        });
    });

    it("returns 400 when match is not OPEN", async () => {
        const matchData = {
            id: 123,
            status: "COMPLETED",
            availableSpots: 2,
            startTime: new Date("2026-04-15T18:00:00.000Z"),
            endTime: new Date("2026-04-15T20:00:00.000Z"),
            creator_id: 999,
            court_id: 1,
            court: {
                name: "Court A",
                type: "INDOOR",
                club: { name: "Club A", city: "City A" },
            },
        };

        const request = createMockRequestForJoin(123);
        const response = createMockResponseWithAuthUser(mockAuthUser);

        findUniqueMock.mockResolvedValueOnce(matchData);

        await joinMatch(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "match is not open",
        });
    });

    it("returns 400 when availableSpots is 0", async () => {
        const matchData = {
            id: 123,
            status: "OPEN",
            availableSpots: 0,
            startTime: new Date("2026-04-15T18:00:00.000Z"),
            endTime: new Date("2026-04-15T20:00:00.000Z"),
            creator_id: 999,
            court_id: 1,
            court: {
                name: "Court A",
                type: "INDOOR",
                club: { name: "Club A", city: "City A" },
            },
        };

        const request = createMockRequestForJoin(123);
        const response = createMockResponseWithAuthUser(mockAuthUser);

        findUniqueMock.mockResolvedValueOnce(matchData);

        await joinMatch(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "no available spots",
        });
    });

    it("returns 400 when user is already a participant", async () => {
        const matchData = {
            id: 123,
            status: "OPEN",
            availableSpots: 2,
            startTime: new Date("2026-04-15T18:00:00.000Z"),
            endTime: new Date("2026-04-15T20:00:00.000Z"),
            creator_id: 999,
            court_id: 1,
            court: {
                name: "Court A",
                type: "INDOOR",
                club: { name: "Club A", city: "City A" },
            },
        };

        const request = createMockRequestForJoin(123);
        const response = createMockResponseWithAuthUser(mockAuthUser);

        findUniqueMock.mockResolvedValueOnce(matchData);
        participantFindUniqueMock.mockResolvedValueOnce({
            user_id: 1,
            match_id: 123,
        });

        await joinMatch(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "user already joined this match",
        });
    });

    it("returns 200 and successfully joins the match", async () => {
        const matchData = {
            id: 123,
            status: "OPEN",
            availableSpots: 3,
            startTime: new Date("2026-04-15T18:00:00.000Z"),
            endTime: new Date("2026-04-15T20:00:00.000Z"),
            creator_id: 999,
            court_id: 1,
            court: {
                name: "Court A",
                type: "INDOOR",
                club: { name: "Club A", city: "City A" },
            },
        };

        const updatedMatch = {
            id: 123,
            status: "OPEN",
            availableSpots: 2,
            startTime: new Date("2026-04-15T18:00:00.000Z"),
            endTime: new Date("2026-04-15T20:00:00.000Z"),
            creator_id: 999,
            court: {
                name: "Court A",
                type: "INDOOR",
                club: { name: "Club A", city: "City A" },
            },
            participants: [
                {
                    user: {
                        id: 1,
                        firstname: "John",
                        lastname: "Doe",
                        email: "user@test.dev",
                        level: 3,
                    },
                    joinedAt: mockedNow,
                },
            ],
        };

        const request = createMockRequestForJoin(123);
        const response = createMockResponseWithAuthUser(mockAuthUser);

        findUniqueMock.mockResolvedValueOnce(matchData);
        participantFindUniqueMock.mockResolvedValueOnce(null);

        transactionMock.mockImplementation(async (callback) => {
            return await callback({
                participant: { create: participantCreateMock },
                match: { update: updateMock },
            });
        });

        updateMock.mockResolvedValueOnce(updatedMatch);

        await joinMatch(request, response);

        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith({
            message: "successfully joined match",
            match: updatedMatch,
        });
    });

    it("decrements availableSpots correctly", async () => {
        const matchData = {
            id: 123,
            status: "OPEN",
            availableSpots: 2,
            startTime: new Date("2026-04-15T18:00:00.000Z"),
            endTime: new Date("2026-04-15T20:00:00.000Z"),
            creator_id: 999,
            court_id: 1,
            court: {
                name: "Court A",
                type: "INDOOR",
                club: { name: "Club A", city: "City A" },
            },
        };

        const updatedMatch = {
            ...matchData,
            availableSpots: 1,
            participants: [
                {
                    user: mockAuthUser,
                    joinedAt: mockedNow,
                },
            ],
        };

        const request = createMockRequestForJoin(123);
        const response = createMockResponseWithAuthUser(mockAuthUser);

        findUniqueMock.mockResolvedValueOnce(matchData);
        participantFindUniqueMock.mockResolvedValueOnce(null);

        transactionMock.mockImplementation(async (callback) => {
            return await callback({
                participant: { create: participantCreateMock },
                match: { update: updateMock },
            });
        });

        updateMock.mockResolvedValueOnce(updatedMatch);

        await joinMatch(request, response);

        expect(updateMock).toHaveBeenCalledWith({
            where: { id: 123 },
            data: {
                availableSpots: 1,
                status: "OPEN",
            },
            select: expect.any(Object),
        });
    });

    it("sets match status to COMPLETED when last spot is filled", async () => {
        const matchData = {
            id: 123,
            status: "OPEN",
            availableSpots: 1,
            startTime: new Date("2026-04-15T18:00:00.000Z"),
            endTime: new Date("2026-04-15T20:00:00.000Z"),
            creator_id: 999,
            court_id: 1,
            court: {
                name: "Court A",
                type: "INDOOR",
                club: { name: "Club A", city: "City A" },
            },
        };

        const updatedMatch = {
            ...matchData,
            availableSpots: 0,
            status: "COMPLETED",
            participants: [
                {
                    user: mockAuthUser,
                    joinedAt: mockedNow,
                },
            ],
        };

        const request = createMockRequestForJoin(123);
        const response = createMockResponseWithAuthUser(mockAuthUser);

        findUniqueMock.mockResolvedValueOnce(matchData);
        participantFindUniqueMock.mockResolvedValueOnce(null);

        transactionMock.mockImplementation(async (callback) => {
            return await callback({
                participant: { create: participantCreateMock },
                match: { update: updateMock },
            });
        });

        updateMock.mockResolvedValueOnce(updatedMatch);

        await joinMatch(request, response);

        expect(updateMock).toHaveBeenCalledWith({
            where: { id: 123 },
            data: {
                availableSpots: 0,
                status: "COMPLETED",
            },
            select: expect.any(Object),
        });
    });

    it("returns 500 when Prisma findUnique fails", async () => {
        const request = createMockRequestForJoin(123);
        const response = createMockResponseWithAuthUser(mockAuthUser);

        findUniqueMock.mockRejectedValueOnce(new Error("database unavailable"));

        await joinMatch(request, response);

        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith({
            message: "Error while joining match",
            error: expect.any(Error),
        });
    });

    it("returns 500 when transaction fails", async () => {
        const matchData = {
            id: 123,
            status: "OPEN",
            availableSpots: 2,
            startTime: new Date("2026-04-15T18:00:00.000Z"),
            endTime: new Date("2026-04-15T20:00:00.000Z"),
            creator_id: 999,
            court_id: 1,
            court: {
                name: "Court A",
                type: "INDOOR",
                club: { name: "Club A", city: "City A" },
            },
        };

        const request = createMockRequestForJoin(123);
        const response = createMockResponseWithAuthUser(mockAuthUser);

        findUniqueMock.mockResolvedValueOnce(matchData);
        participantFindUniqueMock.mockResolvedValueOnce(null);
        transactionMock.mockRejectedValueOnce(new Error("transaction failed"));

        await joinMatch(request, response);

        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith({
            message: "Error while joining match",
            error: expect.any(Error),
        });
    });
});
