import {
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    jest,
} from "@jest/globals";
import type { Request, Response } from "express";

const findUniqueMock =
    jest.fn<(args: Record<string, unknown>) => Promise<unknown>>();
const compareMock =
    jest.fn<(plain: string, hash: string) => Promise<boolean>>();
const signMock =
    jest.fn<
        (
            payload: Record<string, unknown>,
            secret: string,
            options: Record<string, unknown>,
        ) => string
    >();
const getJwtSecretMock = jest.fn(() => "unit-test-secret");

await jest.unstable_mockModule("../../src/db", () => ({
    default: {
        user: {
            findUnique: findUniqueMock,
        },
    },
}));

await jest.unstable_mockModule("bcryptjs", () => ({
    default: {
        compare: compareMock,
    },
}));

await jest.unstable_mockModule("jsonwebtoken", () => ({
    default: {
        sign: signMock,
    },
}));

await jest.unstable_mockModule("../../src/middlewares/auth.middleware", () => ({
    getJwtSecret: getJwtSecretMock,
}));

let login: typeof import("../../src/controllers/auth.controller").login;

beforeAll(async () => {
    ({ login } = await import("../../src/controllers/auth.controller"));
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

const createMockRequest = (body: Record<string, unknown> = {}) =>
    ({
        body,
    }) as Request;

describe("[UNIT TEST] login", () => {
    it("returns 400 when email or password is missing", async () => {
        const request = createMockRequest({ email: "john@test.dev" });
        const response = createMockResponse();

        await login(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "email and password are required",
        });
        expect(findUniqueMock).not.toHaveBeenCalled();
    });

    it("returns 401 when user does not exist", async () => {
        findUniqueMock.mockResolvedValueOnce(null);

        const request = createMockRequest({
            email: "JOHN@TEST.DEV",
            password: "password123",
        });
        const response = createMockResponse();

        await login(request, response);

        expect(findUniqueMock).toHaveBeenCalledWith({
            where: {
                email: "john@test.dev",
            },
            select: {
                id: true,
                firstname: true,
                lastname: true,
                email: true,
                level: true,
                password: true,
            },
        });
        expect(response.status).toHaveBeenCalledWith(401);
        expect(response.json).toHaveBeenCalledWith({
            message: "invalid credentials",
        });
    });

    it("returns 401 when password is invalid", async () => {
        findUniqueMock.mockResolvedValueOnce({
            id: 1,
            firstname: "John",
            lastname: "Doe",
            email: "john@test.dev",
            level: 3,
            password: "hashed-password",
        });
        compareMock.mockResolvedValueOnce(false);

        const request = createMockRequest({
            email: "john@test.dev",
            password: "wrong-password",
        });
        const response = createMockResponse();

        await login(request, response);

        expect(compareMock).toHaveBeenCalledWith(
            "wrong-password",
            "hashed-password",
        );
        expect(response.status).toHaveBeenCalledWith(401);
        expect(response.json).toHaveBeenCalledWith({
            message: "invalid credentials",
        });
        expect(signMock).not.toHaveBeenCalled();
    });

    it("returns 200 with token and user when credentials are valid", async () => {
        findUniqueMock.mockResolvedValueOnce({
            id: 42,
            firstname: "Jane",
            lastname: "Doe",
            email: "jane@test.dev",
            level: 5,
            password: "hashed-password",
        });
        compareMock.mockResolvedValueOnce(true);
        signMock.mockReturnValueOnce("fake-jwt-token");

        const request = createMockRequest({
            email: "  JANE@TEST.DEV  ",
            password: "  password123  ",
        });
        const response = createMockResponse();

        await login(request, response);

        expect(compareMock).toHaveBeenCalledWith(
            "password123",
            "hashed-password",
        );
        expect(getJwtSecretMock).toHaveBeenCalledTimes(1);
        expect(signMock).toHaveBeenCalledWith(
            {
                userId: 42,
                email: "jane@test.dev",
            },
            "unit-test-secret",
            {
                expiresIn: "1d",
            },
        );
        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith({
            message: "login successful",
            token: "fake-jwt-token",
            user: {
                id: 42,
                firstname: "Jane",
                lastname: "Doe",
                email: "jane@test.dev",
                level: 5,
            },
        });
    });

    it("returns 500 when an unexpected error occurs", async () => {
        findUniqueMock.mockRejectedValueOnce(new Error("database offline"));

        const request = createMockRequest({
            email: "john@test.dev",
            password: "password123",
        });
        const response = createMockResponse();

        await login(request, response);

        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith({
            message: "Error while logging in",
            error: expect.any(Error),
        });
    });
});
