import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const findManyMock = jest.fn<() => Promise<any[]>>();

jest.mock('../../src/db', () => ({
	__esModule: true,
	default: {
		user: {
			findMany: findManyMock,
		},
	},
}));

import { getAllUsers } from '../../src/controllers/user.controller';

describe("user.controller - getAllUsers", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("retourne un status 200", async () => {
		findManyMock.mockResolvedValueOnce([]);
		const req = {} as any;
		const json = jest.fn();
		const res = {
			status: jest.fn().mockReturnValue({ json }),
		} as any;

		await getAllUsers(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
	});

	it("retourne un tableau d'utilisateurs", async () => {
		const mockedUsers = [
			{ id: 1, email: 'alice@test.ch', name: 'Alice' },
			{ id: 2, email: 'bob@test.ch', name: 'Bob' },
		];

		findManyMock.mockResolvedValueOnce(mockedUsers);
		const req = {} as any;
		const json = jest.fn();
		const res = {
			status: jest.fn().mockReturnValue({ json }),
		} as any;

		await getAllUsers(req, res);

		expect(findManyMock).toHaveBeenCalledTimes(1);
		expect(res.status).toHaveBeenCalledWith(200);
		expect(json).toHaveBeenCalledWith(mockedUsers);
	});
});



