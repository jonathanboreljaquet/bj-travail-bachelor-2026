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

const prismaMock = {
	court: {
		findMany: findCourtsMock,
	},
	match: {
		findMany: findMatchesMock,
	},
};

await jest.unstable_mockModule("../../src/db", () => ({
	default: prismaMock,
}));

let getAvailableSlots: typeof import("../../src/controllers/available_slot.controller").getAvailableSlots;

beforeAll(async () => {
	({ getAvailableSlots } = await import(
		"../../src/controllers/available_slot.controller"
	));
});

const mockedNow = new Date("2026-04-15T08:30:00.000Z");
const windowEnd = new Date("2026-04-22T00:00:00.000Z");

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

const createCourtTwo = () => ({
	id: 22,
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
	startTime: Object.assign({
		lt: windowEnd,
	}, extra.startTime || {}),
	endTime: Object.assign({
		gt: mockedNow,
	}, extra.endTime || {}),
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
			expectedCourtWhere: buildCourtWhere({
				club: {
					city: {
						equals: "Lancy",
					},
				},
			}),
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

	it("filters slots by startTimeFrom", async () => {
		const court = createCourtOne();
		const startTimeFrom = new Date("2026-04-15T10:00:00.000Z");

		await runGetAvailableSlotsCase({
			query: {
				startTimeFrom: startTimeFrom.toISOString(),
			},
			mockCourts: [court],
			expectedCourtWhere: buildCourtWhere(),
			expectedMatchWhere: {
				startTime: {
					gte: startTimeFrom,
				},
			},
		});
	});

	it("filters slots by startTimeTo", async () => {
		const court = createCourtOne();
		const startTimeTo = new Date("2026-04-16T00:00:00.000Z");

		await runGetAvailableSlotsCase({
			query: {
				startTimeTo: startTimeTo.toISOString(),
			},
			mockCourts: [court],
			expectedCourtWhere: buildCourtWhere(),
			expectedMatchWhere: {
				startTime: {
					lte: startTimeTo,
				},
			},
		});
	});

	it("filters slots by endTimeFrom", async () => {
		const court = createCourtOne();
		const endTimeFrom = new Date("2026-04-15T09:00:00.000Z");

		await runGetAvailableSlotsCase({
			query: {
				endTimeFrom: endTimeFrom.toISOString(),
			},
			mockCourts: [court],
			expectedCourtWhere: buildCourtWhere(),
			expectedMatchWhere: {
				endTime: {
					gte: endTimeFrom,
				},
			},
		});
	});

	it("filters slots by endTimeTo", async () => {
		const court = createCourtOne();
		const endTimeTo = new Date("2026-04-15T12:00:00.000Z");

		await runGetAvailableSlotsCase({
			query: {
				endTimeTo: endTimeTo.toISOString(),
			},
			mockCourts: [court],
			expectedCourtWhere: buildCourtWhere(),
			expectedMatchWhere: {
				endTime: {
					lte: endTimeTo,
				},
			},
		});
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

		const request = createMockRequest();
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
		const startTimeFrom = new Date("2026-04-15T08:00:00.000Z");
		const startTimeTo = new Date("2026-04-16T00:00:00.000Z");
		const endTimeFrom = new Date("2026-04-15T09:00:00.000Z");
		const endTimeTo = new Date("2026-04-15T12:00:00.000Z");

		await runGetAvailableSlotsCase({
			query: {
				city: "Lancy",
				hasEquipmentBox: "true",
				minPricePerPerson: "10",
				maxPricePerPerson: "20",
				slotDuration: "60",
				minSlotDuration: "50",
				maxSlotDuration: "90",
				startTimeFrom: startTimeFrom.toISOString(),
				startTimeTo: startTimeTo.toISOString(),
				endTimeFrom: endTimeFrom.toISOString(),
				endTimeTo: endTimeTo.toISOString(),
				courtType: "INDOOR",
			},
			mockCourts: [court],
			expectedCourtWhere: buildCourtWhere({
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
					equals: 60,
					gte: 50,
					lte: 90,
				},
				type: "INDOOR",
			}),
			expectedMatchWhere: {
				startTime: {
					gte: startTimeFrom,
					lte: startTimeTo,
				},
				endTime: {
					gte: endTimeFrom,
					lte: endTimeTo,
				},
			},
		});
	});

	it("respects the 7-day rolling window from mockedNow", async () => {
		const court = createCourtOne();
		findCourtsMock.mockResolvedValueOnce([court]);
		findMatchesMock.mockResolvedValueOnce([]);

		const request = createMockRequest();
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

		const request = createMockRequest();
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
        prismaMock.match.findMany.mockRejectedValueOnce(
            new Error("database unavailable"),
        );

        const request = createMockRequest();
        const response = createMockResponse();

        await getAvailableSlots(request, response);

        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith({
            message: "Error while fetching available slots",
        });
    });
});
