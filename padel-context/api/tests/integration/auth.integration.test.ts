import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import bcrypt from "bcryptjs";

import app from "../../src/app";
import prisma from "../../src/db";

describe("[INTEGRATION TEST] POST /api/auth/login", () => {
    const uniquePrefix = `auth-integration-${Date.now()}`;
    const createdUserIds: number[] = [];

    const validEmail = `${uniquePrefix}@test.dev`;
    const validPassword = "password123";

    beforeAll(async () => {
        const hashedPassword = await bcrypt.hash(validPassword, 10);

        const user = await prisma.user.create({
            data: {
                firstname: "Auth",
                lastname: "Tester",
                email: validEmail,
                password: hashedPassword,
                level: 4,
            },
        });

        createdUserIds.push(user.id);
    });

    afterAll(async () => {
        await prisma.user.deleteMany({
            where: {
                id: { in: createdUserIds },
            },
        });

        await prisma.$disconnect();
    });

    it("returns HTTP 200 and user payload with valid credentials", async () => {
        const response = await request(app).post("/api/auth/login").send({
            email: validEmail,
            password: validPassword,
        });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("login successful");
        expect(response.body.user.email).toBe(validEmail);
        expect(response.body.user).not.toHaveProperty("password");
        expect(typeof response.body.token).toBe("string");
        expect(response.body.token.length).toBeGreaterThan(20);
    });

    it("returns HTTP 400 when email or password is missing", async () => {
        const response = await request(app).post("/api/auth/login").send({
            email: validEmail,
        });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            message: "email and password are required",
        });
    });

    it("returns HTTP 401 with invalid credentials", async () => {
        const response = await request(app).post("/api/auth/login").send({
            email: validEmail,
            password: "wrong-password",
        });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            message: "invalid credentials",
        });
    });
});
