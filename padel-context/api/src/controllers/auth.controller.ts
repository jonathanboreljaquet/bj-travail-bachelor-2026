import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../db";
import { getJwtSecret } from "../middlewares/auth.middleware";

/**
 * Authentifie un utilisateur et génère un token de session.
 * @param {Request} req - L'objet requête d'Express. Attend `email` et `password` dans le body.
 * @param {Response} res - L'objet réponse d'Express.
 * @returns {200} Succès : Retourne le message "login successful", le token JWT (valide 1 jour) et le profil utilisateur.
 * @throws {400} Mauvaise requête : Déclenché si le body est vide, mal formaté, ou s'il manque l'email ou le mot de passe.
 * @throws {401} Non autorisé : Déclenché si l'utilisateur n'existe pas ou si le mot de passe ne correspond pas.
 * @throws {500} Erreur interne : Déclenché en cas de problème inattendu.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.body || typeof req.body !== "object") {
            res.status(400).json({ message: "invalid request body" });
            return;
        }

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
        res.status(500).json({
            message: "Error while logging in",
            error: error,
        });
    }
};
