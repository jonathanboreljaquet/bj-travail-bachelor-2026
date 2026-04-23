import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

type JwtPayload = {
    userId: number;
    email: string;
};

export const getJwtSecret = (): string =>
    process.env.JWT_SECRET || "dev-jwt-secret-change-me";

export const authenticateJwt = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
            message: "missing or invalid authorization header",
        });
        return;
    }

    const token = authHeader.slice("Bearer ".length).trim();

    try {
        const decoded = jwt.verify(token, getJwtSecret());

        if (
            typeof decoded !== "object" ||
            decoded === null ||
            typeof (decoded as { userId?: unknown }).userId !== "number" ||
            typeof (decoded as { email?: unknown }).email !== "string"
        ) {
            res.status(401).json({ message: "invalid token" });
            return;
        }

        res.locals.authUser = {
            userId: (decoded as JwtPayload).userId,
            email: (decoded as JwtPayload).email,
        } as JwtPayload;

        next();
    } catch (error) {
        res.status(401).json({
            message: "invalid token",
            error: error,
        });
    }
};
