import { Request, Response } from "express";
import { parseDate } from "../utils/helper";
import weatherService from "../services/weather.service";

// Expression régulière pour valider un code postal suisse (exactement 4 chiffres)
const POSTAL_CODE_REGEX = /^\d{4}$/;

/**
 * Formate une date en une chaîne compacte (YYYYMMDDHH00) tout en arrondissant
 * à l'heure pile (les minutes sont forcées à "00").
 * Dans le but d'interroger l'API MeteoSwiss qui fonctionnent par tranches horaires.
 * Référence : https://opendatadocs.meteoswiss.ch/e-forecast-data/e4-local-forecast-data#data-format
 * @param {Date} date - L'objet Date à formater.
 * @returns {string} La date formatée (ex: "202606020400").
 */
function formatCompactDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = "00";
    return `${year}${month}${day}${hours}${minutes}`;
}

/**
 * Récupère les prévisions météorologiques pour un code postal et un créneau précis.
 * @param {Request} req - L'objet requête d'Express.
 * @param {string} req.query.postalCode - (Requis) Le code postal à 4 chiffres (ex: "1227" pour Carouge).
 * @param {string} req.query.datetime - (Requis) La date et l'heure ciblées (format ISO).
 * @param {Response} res - L'objet réponse d'Express.
 * @returns {200} Succès : Retourne les données météo associées à la localité et l'heure.
 * @throws {400} Mauvaise requête : Code postal invalide ou date manquante/mal formatée.
 * @throws {404} Non trouvé : L'API météo ne connaît aucun point de mesure pour ce code postal.
 * @throws {500} Erreur interne : Problème inattendu ou panne du service météo.
 */
export const getWeather = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const postalCode =
            typeof req.query.postalCode === "string"
                ? req.query.postalCode.trim()
                : "";
        const datetime = parseDate(req.query.datetime);

        if (!POSTAL_CODE_REGEX.test(postalCode)) {
            res.status(400).json({
                message: "postalCode must be exactly 4 digits",
            });
            return;
        }

        if (!datetime) {
            res.status(400).json({
                message: "datetime is required",
            });
            return;
        }

        const roundedDatetime = formatCompactDate(datetime);

        const weather = await weatherService.getWeatherDataForPostalCode(
            postalCode,
            roundedDatetime,
        );

        res.status(200).json({
            postalCode,
            datetime: roundedDatetime,
            ...weather,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("No point_id found for postal code")
        ) {
            res.status(404).json({
                message: error.message,
            });
            return;
        }

        res.status(500).json({
            message: "Error while fetching weather",
            error: error,
        });
    }
};
