import { beforeAll, afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const findManyMock = jest.fn<(args: Record<string, unknown>) => Promise<unknown[]>>();

const prismaMock = {
  match: {
    findMany: findManyMock,
  },
};

await jest.unstable_mockModule('../../src/db', () => ({
  default: prismaMock,
}));

let getMatches: typeof import('../../src/controllers/match.controller').getMatches;

beforeAll(async () => {
  ({ getMatches } = await import('../../src/controllers/match.controller'));
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

const createMockRequest = (query: Record<string, unknown> = {}) => ({
  query,
}) as Request;

const createMatch = () => ({
  id: 101,
  startTime: new Date('2026-04-15T18:00:00.000Z'),
  endTime: new Date('2026-04-15T20:00:00.000Z'),
  status: 'OPEN',
  availableSpots: 2,
  equipmentRental: true,
  court: {
    name: 'Court Alpha',
    type: 'INDOOR',
    hasEquipmentBox: true,
    pricePerPerson: 18,
    slotDuration: 120,
    club: {
      name: 'Geneva Club',
      city: 'Lancy',
      openingTime: '08:00',
      closingTime: '23:00',
    },
  },
  participants: [
    {
      user: {
        firstname: 'Ana',
        lastname: 'Martinez',
        email: 'ana@test.dev',
        level: 2,
      },
    },
    {
      user: {
        firstname: 'Luca',
        lastname: 'Rossi',
        email: 'luca@test.dev',
        level: 4,
      },
    },
  ],
});

describe('getMatches', () => {
  it('returns open matches with the default includes', async () => {
    const match = createMatch();
    prismaMock.match.findMany.mockResolvedValueOnce([match]);

    const request = createMockRequest();
    const response = createMockResponse();

    await getMatches(request, response);

    expect(prismaMock.match.findMany).toHaveBeenCalledWith({
      where: {
        status: 'OPEN',
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
      {
        id: 101,
        startTime: match.startTime,
        endTime: match.endTime,
        status: 'OPEN',
        availableSpots: 2,
        equipmentRental: true,
        club: match.court.club,
        court: {
          name: 'Court Alpha',
          type: 'INDOOR',
          hasEquipmentBox: true,
          pricePerPerson: 18,
          slotDuration: 120,
        },
        participants: [
          {
            firstname: 'Ana',
            lastname: 'Martinez',
            email: 'ana@test.dev',
            level: 2,
          },
          {
            firstname: 'Luca',
            lastname: 'Rossi',
            email: 'luca@test.dev',
            level: 4,
          },
        ],
      },
    ]);
  });

  it('applies query filters and include selection', async () => {
    const match = createMatch();
    prismaMock.match.findMany.mockResolvedValueOnce([match]);

    const request = createMockRequest({
      status: 'completed',
      city: 'Lancy',
      hasEquipmentBox: 'true',
      minPricePerPerson: '10',
      maxPricePerPerson: '20',
      slotDuration: '120',
      minAvailableSpots: '2',
      startTimeFrom: '2026-04-01T00:00:00.000Z',
      startTimeTo: '2026-04-30T23:59:59.000Z',
      endTimeFrom: '2026-04-01T00:00:00.000Z',
      endTimeTo: '2026-04-30T23:59:59.000Z',
      include: 'club',
    });
    const response = createMockResponse();

    await getMatches(request, response);

    expect(prismaMock.match.findMany).toHaveBeenCalledWith({
      where: {
        status: 'COMPLETED',
        availableSpots: {
          gte: 2,
        },
        startTime: {
          gte: new Date('2026-04-01T00:00:00.000Z'),
          lte: new Date('2026-04-30T23:59:59.000Z'),
        },
        endTime: {
          gte: new Date('2026-04-01T00:00:00.000Z'),
          lte: new Date('2026-04-30T23:59:59.000Z'),
        },
        court: {
          club: {
            city: {
              equals: 'Lancy',
              mode: 'insensitive',
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
    expect(response.json).toHaveBeenCalledWith([
      {
        id: 101,
        startTime: match.startTime,
        endTime: match.endTime,
        status: 'OPEN',
        availableSpots: 2,
        equipmentRental: true,
        club: match.court.club,
      },
    ]);
  });

  it('filters matches by participant average level', async () => {
    const match = createMatch();
    prismaMock.match.findMany.mockResolvedValueOnce([match]);

    const request = createMockRequest({
      participantAverageLevel: '5',
      participantAverageLevelTolerance: '0.1',
    });
    const response = createMockResponse();

    await getMatches(request, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith([]);
  });

  it('returns a 500 response when Prisma fails', async () => {
    prismaMock.match.findMany.mockRejectedValueOnce(new Error('database unavailable'));

    const request = createMockRequest();
    const response = createMockResponse();

    await getMatches(request, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Error while fetching open matches',
    });
  });
});