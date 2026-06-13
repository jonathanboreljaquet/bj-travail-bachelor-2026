import { Router } from "express";
import { login } from "../controllers/auth.controller";

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authentifier un utilisateur
 *     description: Permet à un utilisateur de s'authentifier en fournissant son email et son mot de passe. Retourne un token JWT et les informations de l'utilisateur.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       description: Les identifiants de l'utilisateur
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: L'adresse email de l'utilisateur
 *                 example: "jonathan.borel@padelcontext.com"
 *               password:
 *                 type: string
 *                 description: Le mot de passe de l'utilisateur
 *                 example: "pomme123"
 *     responses:
 *       200:
 *         description: Authentification réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "login successful"
 *                 token:
 *                   type: string
 *                   description: Token JWT valide pour 24 heures
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: ID unique de l'utilisateur
 *                       example: 21
 *                     firstname:
 *                       type: string
 *                       description: Prénom de l'utilisateur
 *                       example: "Jonathan"
 *                     lastname:
 *                       type: string
 *                       description: Nom de famille de l'utilisateur
 *                       example: "Borel-Jaquet"
 *                     email:
 *                       type: string
 *                       format: email
 *                       description: Adresse email de l'utilisateur
 *                       example: "jonathan.borel@padelcontext.com"
 *                     level:
 *                       type: integer
 *                       description: Niveau de jeu (de 1 pour débutant à 10 pour expert)
 *                       example: 2
 *       400:
 *         description: Erreur de validation - Body invalide, ou email/mot de passe manquants ou invalides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "email and password are required"
 *             examples:
 *               missing_fields:
 *                 summary: Paramètres manquants
 *                 value:
 *                   message: "email and password are required"
 *               empty_fields:
 *                 summary: Paramètres vides
 *                 value:
 *                   message: "email and password are required"
 *               invalid_body:
 *                 summary: Body absent ou non JSON (pas un objet)
 *                 value:
 *                   message: "invalid request body"
 *       401:
 *         description: Authentification échouée - Email non trouvé ou mot de passe incorrect
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "invalid credentials"
 *             examples:
 *               invalid_credentials:
 *                 summary: Identifiants invalides
 *                 value:
 *                   message: "invalid credentials"
 *       500:
 *         description: Erreur serveur interne
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error while logging in"
 */
router.post("/login", login);

export default router;
