import request from 'supertest';
import { describe, it, expect, afterAll } from '@jest/globals';

import app from '../../src/app';
import prisma from '../../src/db';

describe('GET /users', () => {
	afterAll(async () => {
		await prisma.$disconnect();
	});

	it('returns HTTP code 200', async () => {
		const response = await request(app).get('/api/users');

		expect(response.status).toBe(200);
	});

	it('returns users with firstname, lastname, email and level only', async () => {
		const response = await request(app).get('/api/users');
		const users = response.body as any[];

		expect(response.status).toBe(200);
		expect(Array.isArray(users)).toBe(true);
		expect(users.length).toBeGreaterThan(0);

		users.forEach((user: any) => {
			expect(user).toHaveProperty('firstname');
			expect(user).toHaveProperty('lastname');
			expect(user).toHaveProperty('email');
			expect(user).toHaveProperty('level');
			expect(user).not.toHaveProperty('id');
			expect(user).not.toHaveProperty('password');
			expect(user).not.toHaveProperty('createdAt');
		});
	});
});



