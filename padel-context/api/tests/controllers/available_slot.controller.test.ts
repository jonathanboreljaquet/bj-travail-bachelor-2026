import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    jest,
} from "@jest/globals";
import type { Request, Response } from "express";

const findCourtsMock =
    jest.fn<(args: Record<string, unknown>) => Promise<unknown[]>>();
const findMatchesMock =
    jest.fn<(args: Record<string, unknown>) => Promise<unknown[]>>();
const findCourtByIdMock = jest.fn<
    (args: Record<string, unknown>) => Promise<{
        id: number;
        slotDuration: number;
        club: { openingTime: string; closingTime: string };
    } | null>
>();
const participantCountMock =
    jest.fn<(args: Record<string, unknown>) => Promise<number>>();
const findOverlappingMatchMock =
    jest.fn<
        (args: Record<string, unknown>) => Promise<{ id: number } | null>
    >();
const matchCreateMock =
    jest.fn<(args: Record<string, unknown>) => Promise<{ id: number }>>();
const matchFindUniqueMock =
    jest.fn<(args: Record<string, unknown>) => Promise<unknown>>();
const participantCreateMock =
    jest.fn<(args: Record<string, unknown>) => Promise<unknown>>();
const transactionMock = jest.fn<
    (
        callback: (tx: {
            match: {
                create: typeof matchCreateMock;
                findUnique: typeof matchFindUniqueMock;
            };
            participant: {
                create: typeof participantCreateMock;
            };
        }) => Promise<unknown>,
    ) => Promise<unknown>
>();

const prismaMock = {
    court: {
        findMany: findCourtsMock,
        findUnique: findCourtByIdMock,
    },
    participant: {
        count: participantCountMock,
    },
    match: {
        findMany: findMatchesMock,
        findFirst: findOverlappingMatchMock,
    },
    $transaction: transactionMock,
};

await jest.unstable_mockModule("../../src/db", () => ({
    default: prismaMock,
}));

let getAvailableSlots: typeof import("../../src/controllers/available_slot.controller").getAvailableSlots;
let createMatchFromSlot: typeof import("../../src/controllers/available_slot.controller").createMatchFromSlot;

beforeAll(async () => {
    ({ getAvailableSlots, createMatchFromSlot } =
        await import("../../src/controllers/available_slot.controller"));
});

const mockedNow = new Date("2026-04-15T08:30:00.000Z");
const windowEnd = new Date("2026-04-22T00:00:00.000Z");

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockedNow);
    participantCountMock.mockResolvedValue(0);
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

const createMockCreateRequest = (body: Record<string, unknown> = {}) =>
    ({
        body,
    }) as unknown as Request;

const createMockResponseWithAuthUser = (
    authUser: { userId: number; email: string } | null = {
        userId: 1,
        email: "user@test.dev",
    },
) => {
    const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: {
            authUser: authUser ?? undefined,
        },
    };

    return response as unknown as Response;
};

const createCourtOne = () => ({
    id: 11,
    name: "Court Alpha",
    type: "INDOOR",
    hasEquipmentBox: true,
    pricePerPerson: 18,
    slotDuration: 60,
    club: {
        name: "Geneva Club",
        city: "Lancy",
        openingTime: "08:00",
        closingTime: "10:00",
    },
});

const expectedCourtSelect = {
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
};

const buildCourtWhere = (extra: Record<string, unknown> = {}) => ({
    ...extra,
});

const buildMatchWhere = (
    courtIds: number[],
    extra: Record<string, unknown> = {},
) => ({
    court_id: {
        in: courtIds,
    },
    status: {
        in: ["OPEN", "COMPLETED"],
    },
    startTime: Object.assign(
        {
            lt: windowEnd,
        },
        extra.startTime || {},
    ),
    endTime: Object.assign(
        {
            gt: mockedNow,
        },
        extra.endTime || {},
    ),
});

const runGetAvailableSlotsCase = async ({
    query = {},
    mockCourts,
    mockMatches = [],
    expectedCourtWhere,
    expectedMatchWhere = {},
}: {
    query?: Record<string, unknown>;
    mockCourts: unknown[];
    mockMatches?: unknown[];
    expectedCourtWhere: Record<string, unknown>;
    expectedMatchWhere?: Record<string, unknown>;
}) => {
    findCourtsMock.mockResolvedValueOnce(mockCourts);
    findMatchesMock.mockResolvedValueOnce(mockMatches);

    const request = createMockRequest(query);
    const response = createMockResponse();

    await getAvailableSlots(request, response);

    expect(findCourtsMock).toHaveBeenCalledWith({
        where: expectedCourtWhere,
        select: expectedCourtSelect,
    });

    if (mockCourts.length > 0) {
        const courtIds = (mockCourts as Array<{ id: number }>).map(
            (court) => court.id,
        );
        expect(findMatchesMock).toHaveBeenCalledWith({
            where: buildMatchWhere(courtIds, expectedMatchWhere),
            select: {
                court_id: true,
                status: true,
                startTime: true,
                endTime: true,
            },
        });
    }

    expect(response.status).toHaveBeenCalledWith(200);

    return response;
};

describe("[UNIT TEST] getAvailableSlots", () => {
    it("returns all slots when no filter is provided", async () => {
        const court = createCourtOne();

        await runGetAvailableSlotsCase({
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere(),
        });
    });

    it("filters slots by city", async () => {
        const court = createCourtOne();

        await runGetAvailableSlotsCase({
            query: {
                city: "Lancy",
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere(),
        });
    });

    it("filters slots by hasEquipmentBox", async () => {
        const court = createCourtOne();

        await runGetAvailableSlotsCase({
            query: {
                hasEquipmentBox: "true",
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere({
                hasEquipmentBox: true,
            }),
        });
    });

    it("filters slots by minPricePerPerson", async () => {
        const court = createCourtOne();

        await runGetAvailableSlotsCase({
            query: {
                minPricePerPerson: "10",
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere({
                pricePerPerson: {
                    gte: 10,
                },
            }),
        });
    });

    it("filters slots by maxPricePerPerson", async () => {
        const court = createCourtOne();

        await runGetAvailableSlotsCase({
            query: {
                maxPricePerPerson: "20",
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere({
                pricePerPerson: {
                    lte: 20,
                },
            }),
        });
    });

    it("filters slots by slotDuration", async () => {
        const court = createCourtOne();

        await runGetAvailableSlotsCase({
            query: {
                slotDuration: "60",
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere({
                slotDuration: {
                    equals: 60,
                },
            }),
        });
    });

    it("filters slots by minSlotDuration", async () => {
        const court = createCourtOne();

        await runGetAvailableSlotsCase({
            query: {
                minSlotDuration: "50",
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere({
                slotDuration: {
                    gte: 50,
                },
            }),
        });
    });

    it("filters slots by maxSlotDuration", async () => {
        const court = createCourtOne();

        await runGetAvailableSlotsCase({
            query: {
                maxSlotDuration: "90",
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere({
                slotDuration: {
                    lte: 90,
                },
            }),
        });
    });

    it("filters slots by courtType", async () => {
        const court = createCourtOne();

        await runGetAvailableSlotsCase({
            query: {
                courtType: "indoor",
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere({
                type: "INDOOR",
            }),
        });
    });

    it("Filters slots by timeFrom", async () => {
        const court = createCourtOne();
        const timeFrom = new Date("2026-04-15T10:00:00.000Z");

        await runGetAvailableSlotsCase({
            query: {
                timeFrom: timeFrom.toISOString(),
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere(),
            expectedMatchWhere: {
                endTime: {
                    gt: timeFrom,
                },
            },
        });
    });

    it("Filters slots by timeTo", async () => {
        const court = createCourtOne();
        const timeTo = new Date("2026-04-16T00:00:00.000Z");

        await runGetAvailableSlotsCase({
            query: {
                timeTo: timeTo.toISOString(),
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere(),
            expectedMatchWhere: {
                startTime: {
                    lt: timeTo,
                },
            },
        });
    });

    it("Filters slots by timeFrom and timeTo", async () => {
        const court = createCourtOne();
        const timeFrom = new Date("2026-04-15T09:00:00.000Z");
        const timeTo = new Date("2026-04-15T10:00:00.000Z");

        await runGetAvailableSlotsCase({
            query: {
                timeFrom: timeFrom.toISOString(),
                timeTo: timeTo.toISOString(),
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere(),
            expectedMatchWhere: {
                startTime: {
                    lt: timeTo,
                },
                endTime: {
                    gt: timeFrom,
                },
            },
        });
    });

    it("returns a 400 response when timeTo is before timeFrom", async () => {
        const request = createMockRequest({
            timeFrom: "2026-04-15T10:00:00.000Z",
            timeTo: "2026-04-15T09:00:00.000Z",
        });
        const response = createMockResponse();

        await getAvailableSlots(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "timeTo must be greater than timeFrom",
        });
        expect(findCourtsMock).not.toHaveBeenCalled();
        expect(findMatchesMock).not.toHaveBeenCalled();
    });

    it("returns slots with occupied matches excluded", async () => {
        const court = createCourtOne();
        findCourtsMock.mockResolvedValueOnce([court]);
        findMatchesMock.mockResolvedValueOnce([
            {
                court_id: court.id,
                status: "OPEN",
                startTime: new Date("2026-04-16T06:00:00.000Z"),
                endTime: new Date("2026-04-16T07:00:00.000Z"),
            },
        ]);

        const request = createMockRequest({ limit: "50" });
        const response = createMockResponse();

        await getAvailableSlots(request, response);

        expect(response.status).toHaveBeenCalledWith(200);
        const payload = (response.json as jest.Mock).mock.calls[0][0] as Array<{
            court: { id: number };
            availableSlots: Array<{ startTime: string; endTime: string }>;
        }>;
        expect(payload).toHaveLength(1);
        expect(payload[0].court.id).toBe(11);
        expect(payload[0].availableSlots).toHaveLength(13);
        expect(payload[0].availableSlots[0]).toEqual({
            startTime: "2026-04-15T09:00:00.000Z",
            endTime: "2026-04-15T10:00:00.000Z",
        });
    });

    it("filters slots with all query parameters combined", async () => {
        const court = createCourtOne();
        const timeFrom = new Date("2026-04-15T08:00:00.000Z");
        const timeTo = new Date("2026-04-16T00:00:00.000Z");

        await runGetAvailableSlotsCase({
            query: {
                city: "Lancy",
                hasEquipmentBox: "true",
                minPricePerPerson: "10",
                maxPricePerPerson: "20",
                slotDuration: "60",
                minSlotDuration: "50",
                maxSlotDuration: "90",
                timeFrom: timeFrom.toISOString(),
                timeTo: timeTo.toISOString(),
                courtType: "INDOOR",
            },
            mockCourts: [court],
            expectedCourtWhere: buildCourtWhere({
                hasEquipmentBox: true,
                pricePerPerson: {
                    gte: 10,
                    lte: 20,
                },
                slotDuration: {
                    equals: 60,
                    gte: 50,
                    lte: 90,
                },
                type: "INDOOR",
            }),
            expectedMatchWhere: {
                startTime: {
                    lt: timeTo,
                },
                endTime: {
                    gt: timeFrom,
                },
            },
        });
    });

    it("respects the 7-day rolling window from mockedNow", async () => {
        const court = createCourtOne();
        findCourtsMock.mockResolvedValueOnce([court]);
        findMatchesMock.mockResolvedValueOnce([]);

        const request = createMockRequest({ limit: "50" });
        const response = createMockResponse();

        await getAvailableSlots(request, response);

        expect(findMatchesMock).toHaveBeenCalledWith({
            where: {
                court_id: {
                    in: [11],
                },
                status: {
                    in: ["OPEN", "COMPLETED"],
                },
                startTime: {
                    lt: windowEnd,
                },
                endTime: {
                    gt: mockedNow,
                },
            },
            select: {
                court_id: true,
                status: true,
                startTime: true,
                endTime: true,
            },
        });
    });

    it("blocks OPEN and COMPLETED slots, but keeps CANCELED slots available", async () => {
        const court = {
            ...createCourtOne(),
            club: {
                ...createCourtOne().club,
                openingTime: "07:00",
                closingTime: "21:00",
            },
        };

        findCourtsMock.mockResolvedValueOnce([court]);
        findMatchesMock.mockResolvedValueOnce([
            {
                court_id: court.id,
                status: "OPEN",
                startTime: new Date("2026-04-16T06:00:00.000Z"),
                endTime: new Date("2026-04-16T07:00:00.000Z"),
            },
            {
                court_id: court.id,
                status: "COMPLETED",
                startTime: new Date("2026-04-16T17:00:00.000Z"),
                endTime: new Date("2026-04-16T18:00:00.000Z"),
            },
            {
                court_id: court.id,
                status: "CANCELED",
                startTime: new Date("2026-04-16T08:00:00.000Z"),
                endTime: new Date("2026-04-16T09:00:00.000Z"),
            },
        ]);

        const request = createMockRequest({ limit: "50" });
        const response = createMockResponse();

        await getAvailableSlots(request, response);

        expect(response.status).toHaveBeenCalledWith(200);
        const payload = (response.json as jest.Mock).mock.calls[0][0] as Array<{
            court: { id: number };
            availableSlots: Array<{ startTime: string; endTime: string }>;
        }>;

        const daySlots = payload[0].availableSlots.filter((slot) =>
            slot.startTime.startsWith("2026-04-16T"),
        );
        const daySlotStarts = daySlots.map((slot) => slot.startTime);

        expect(daySlotStarts).not.toContain("2026-04-16T05:00:00.000Z");
        expect(daySlotStarts).not.toContain("2026-04-16T06:00:00.000Z");
        expect(daySlotStarts).toContain("2026-04-16T07:00:00.000Z");
        expect(daySlotStarts).toContain("2026-04-16T08:00:00.000Z");
        expect(daySlotStarts).not.toContain("2026-04-16T17:00:00.000Z");
        expect(daySlotStarts).toContain("2026-04-16T18:00:00.000Z");
    });

    it("returns a 500 response when Prisma fails", async () => {
        findCourtsMock.mockRejectedValueOnce(new Error("database unavailable"));

        const request = createMockRequest();
        const response = createMockResponse();

        await getAvailableSlots(request, response);

        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Error while fetching available slots",
                error: expect.any(Error),
            }),
        );
    });
});

describe("[UNIT TEST] createMatchFromSlot", () => {
    const authUser = { userId: 1, email: "user@test.dev" };

    const validBody = {
        courtId: 11,
        startTime: "2026-04-16T08:00:00.000Z",
        endTime: "2026-04-16T09:00:00.000Z",
    };

    const openCourt = {
        id: 11,
        slotDuration: 60,
        club: {
            openingTime: "08:00",
            closingTime: "22:00",
        },
    };

    it("returns 401 when auth user is missing", async () => {
        const request = createMockCreateRequest(validBody);
        const response = createMockResponseWithAuthUser(null);

        await createMatchFromSlot(request, response);

        expect(response.status).toHaveBeenCalledWith(401);
        expect(response.json).toHaveBeenCalledWith({ message: "unauthorized" });
    });

    it("returns 400 when required fields are missing", async () => {
        const request = createMockCreateRequest({
            courtId: 11,
            startTime: validBody.startTime,
        });
        const response = createMockResponseWithAuthUser(authUser);

        await createMatchFromSlot(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "courtId, startTime and endTime are required",
        });
    });

    it("returns 400 when slot range is invalid", async () => {
        const request = createMockCreateRequest({
            courtId: 11,
            startTime: "2026-04-16T09:00:00.000Z",
            endTime: "2026-04-16T08:00:00.000Z",
        });
        const response = createMockResponseWithAuthUser(authUser);

        await createMatchFromSlot(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "invalid slot range",
        });
    });

    it("returns 403 when the user already has 5 future matches", async () => {
        const request = createMockCreateRequest(validBody);
        const response = createMockResponseWithAuthUser(authUser);

        participantCountMock.mockResolvedValueOnce(5);

        await createMatchFromSlot(request, response);

        expect(participantCountMock).toHaveBeenCalledWith({
            where: {
                user_id: authUser.userId,
                match: {
                    startTime: {
                        gte: mockedNow,
                    },
                },
            },
        });
        expect(findCourtByIdMock).not.toHaveBeenCalled();
        expect(response.status).toHaveBeenCalledWith(403);
        expect(response.json).toHaveBeenCalledWith({
            message:
                "You cannot participate in more than 5 upcoming matches at the same time",
        });
    });

    it("returns 404 when court does not exist", async () => {
        const request = createMockCreateRequest(validBody);
        const response = createMockResponseWithAuthUser(authUser);

        findCourtByIdMock.mockResolvedValueOnce(null);

        await createMatchFromSlot(request, response);

        expect(response.status).toHaveBeenCalledWith(404);
        expect(response.json).toHaveBeenCalledWith({
            message: "court not found",
        });
    });

    it("returns 400 when duration does not match court slotDuration", async () => {
        const request = createMockCreateRequest({
            courtId: 11,
            startTime: "2026-04-16T08:00:00.000Z",
            endTime: "2026-04-16T10:00:00.000Z",
        });
        const response = createMockResponseWithAuthUser(authUser);

        findCourtByIdMock.mockResolvedValueOnce(openCourt);

        await createMatchFromSlot(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "slot duration does not match court slotDuration",
        });
    });

    it("returns 400 when slot is outside opening hours", async () => {
        const request = createMockCreateRequest({
            courtId: 11,
            startTime: "2026-04-16T07:00:00.000Z",
            endTime: "2026-04-16T08:00:00.000Z",
        });
        const response = createMockResponseWithAuthUser(authUser);

        findCourtByIdMock.mockResolvedValueOnce(openCourt);

        await createMatchFromSlot(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "slot is outside club opening hours",
        });
    });

    it("returns 400 when slot is not aligned with slotDuration grid", async () => {
        const request = createMockCreateRequest({
            courtId: 11,
            startTime: "2026-04-16T08:30:00.000Z",
            endTime: "2026-04-16T09:30:00.000Z",
        });
        const response = createMockResponseWithAuthUser(authUser);

        findCourtByIdMock.mockResolvedValueOnce(openCourt);

        await createMatchFromSlot(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "slot is not aligned with court slotDuration",
        });
    });

    it("returns 400 when slot is outside the next 7 days", async () => {
        const request = createMockCreateRequest({
            courtId: 11,
            startTime: "2026-04-25T08:00:00.000Z",
            endTime: "2026-04-25T09:00:00.000Z",
        });
        const response = createMockResponseWithAuthUser(authUser);

        findCourtByIdMock.mockResolvedValueOnce(openCourt);

        await createMatchFromSlot(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "slot must be within the next 7 days",
        });
    });

    it("returns 409 when slot overlaps with an OPEN or COMPLETED match", async () => {
        const request = createMockCreateRequest(validBody);
        const response = createMockResponseWithAuthUser(authUser);

        findCourtByIdMock.mockResolvedValueOnce(openCourt);
        findOverlappingMatchMock.mockResolvedValueOnce({ id: 999 });

        await createMatchFromSlot(request, response);

        expect(response.status).toHaveBeenCalledWith(409);
        expect(response.json).toHaveBeenCalledWith({
            message: "slot is no longer available",
        });
    });

    it("returns 201 and creates match with creator as participant", async () => {
        const request = createMockCreateRequest(validBody);
        const response = createMockResponseWithAuthUser(authUser);

        const createdMatch = { id: 321 };
        const finalMatch = {
            id: 321,
            status: "OPEN",
            availableSpots: 3,
            startTime: new Date(validBody.startTime),
            endTime: new Date(validBody.endTime),
            creator_id: authUser.userId,
            court: {
                name: "Court Alpha",
                type: "INDOOR",
                club: { name: "Geneva Club", city: "Lancy" },
            },
            participants: [
                {
                    user: {
                        id: authUser.userId,
                        firstname: "John",
                        lastname: "Doe",
                        email: authUser.email,
                        level: 3,
                    },
                    joinedAt: mockedNow,
                },
            ],
        };

        findCourtByIdMock.mockResolvedValueOnce(openCourt);
        findOverlappingMatchMock.mockResolvedValueOnce(null);

        transactionMock.mockImplementation(async (callback) => {
            return await callback({
                match: {
                    create: matchCreateMock,
                    findUnique: matchFindUniqueMock,
                },
                participant: {
                    create: participantCreateMock,
                },
            });
        });

        matchCreateMock.mockResolvedValueOnce(createdMatch);
        matchFindUniqueMock.mockResolvedValueOnce(finalMatch);

        await createMatchFromSlot(request, response);

        expect(matchCreateMock).toHaveBeenCalledWith({
            data: {
                startTime: new Date(validBody.startTime),
                endTime: new Date(validBody.endTime),
                status: "OPEN",
                availableSpots: 3,
                court_id: 11,
                creator_id: authUser.userId,
            },
            select: {
                id: true,
            },
        });

        expect(participantCreateMock).toHaveBeenCalledWith({
            data: {
                user_id: authUser.userId,
                match_id: createdMatch.id,
            },
        });

        expect(response.status).toHaveBeenCalledWith(201);
        expect(response.json).toHaveBeenCalledWith({
            message: "match created from slot",
            match: finalMatch,
        });
    });

    it("returns 500 when transaction fails", async () => {
        const request = createMockCreateRequest(validBody);
        const response = createMockResponseWithAuthUser(authUser);

        findCourtByIdMock.mockResolvedValueOnce(openCourt);
        findOverlappingMatchMock.mockResolvedValueOnce(null);
        transactionMock.mockRejectedValueOnce(new Error("transaction failed"));

        await createMatchFromSlot(request, response);

        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith({
            message: "Error while creating match from slot",
            error: new Error("transaction failed"),
        });
    });
});
