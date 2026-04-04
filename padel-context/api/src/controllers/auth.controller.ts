import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../db";
import { getJwtSecret } from "../middlewares/auth.middleware";

export const login = async (req: Request, res: Response): Promise<void> => {
	try {
		const { email, password } = req.body as {
			email?: unknown;
			password?: unknown;
		};

		if (typeof email !== "string" || typeof password !== "string") {
			res.status(400).json({
				message: "email and password are required",
			});
			return;
		}

		const normalizedEmail = email.trim().toLowerCase();
		const normalizedPassword = password.trim();

		if (!normalizedEmail || !normalizedPassword) {
			res.status(400).json({
				message: "email and password are required",
			});
			return;
		}

		const user = await prisma.user.findUnique({
			where: {
				email: normalizedEmail,
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

		if (!user) {
			res.status(401).json({
				message: "invalid credentials",
			});
			return;
		}

		const passwordMatches = await bcrypt.compare(
			normalizedPassword,
			user.password,
		);

		if (!passwordMatches) {
			res.status(401).json({
				message: "invalid credentials",
			});
			return;
		}

		const token = jwt.sign(
			{
				userId: user.id,
				email: user.email,
			},
			getJwtSecret(),
			{
				expiresIn: "1d",
			},
		);

		res.status(200).json({
			message: "login successful",
			token,
			user: {
				id: user.id,
				firstname: user.firstname,
				lastname: user.lastname,
				email: user.email,
				level: user.level,
			},
		});
	} catch (error) {
        console.error("Login error:", error);
		res.status(500).json({
			message: "Error while logging in",
		});
	}
};