import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

// Définition de la structure attendue à l'intérieur du token JWT
type JwtPayload = {
    userId: number;
    email: string;
};

/**
 * Récupère la clé secrète utilisée pour signer et vérifier les tokens JWT.
 * @returns {string} La clé secrète (depuis les variables d'environnement ou une valeur par défaut).
 */
export const getJwtSecret = (): string =>
    process.env.AUTH_JWT_SECRET || "default-jwt-secret";

/**
 * Middleware Express pour authentifier les requêtes via un token JWT (Bearer Token).
 * Ce middleware intercepte la requête avant qu'elle n'atteigne le contrôleur final.
 * S'il réussit, il injecte les infos de l'utilisateur dans `res.locals.authUser`.
 * S'il échoue, il bloque la requête et renvoie une erreur 401 (Unauthorized).
 * @param {Request} req - L'objet requête d'Express.
 * @param {Response} res - L'objet réponse d'Express.
 * @param {NextFunction} next - Fonction pour passer au middleware/contrôleur suivant.
 */
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
