import { AsyncLocalStorage } from "node:async_hooks";
import z from "zod/v4";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export const API_BASE_URL = "http://api:3000/api";

export const LOCAL_TIMEZONE = "Europe/Zurich";

// Ensemble des paramètres de date/heure attendus dans les inputs des tools
export const dateParameters = [
    "timeFrom",
    "timeTo",
    "startTimeFrom",
    "startTimeTo",
    "endTimeFrom",
    "endTimeTo",
    "startTime",
    "endTime",
    "datetime",
];

export const isoTimeStr = z
    .string()
    .describe("Local time strictly in 'YYYY-MM-DDTHH:mm:ss' format.");

// Le contexte partagé pour le token JWT
export const tokenContext = new AsyncLocalStorage<string | undefined>();

export const courtTypeTranslations: Record<string, string> = {
    INDOOR: "Intérieur",
    OUTDOOR: "Extérieur",
    COVERED: "Couvert",
};

// Schema zod de validation pour les réponses de l'API REST afin de s'assurer que les données utilisées par le LLM sont fiables
const weatherVerificationSchema = z.object({
    precipitationProbabilityPct: z.number().nullable(),
    windSpeedKmh: z.number().nullable(),
    temperatureCelsius: z.number().nullable(),
});

/**
 * Récupère les prévisions météorologiques pour un code postal et un créneau horaire donnés.
 * @param {string} postalCode - Le code postal.
 * @param {string} utcDatetime - La date et heure cible au format ISO 8601 UTC.
 * @returns {Promise<{ precipitationProbabilityPct: number, windSpeedKmh: number, temperatureCelsius: number } | undefined>}
 */
export async function fetchWeatherForOutdoor(
    postalCode: string,
    utcDatetime: string,
) {
    try {
        const res = await fetch(
            `${API_BASE_URL}/weather?postalCode=${encodeURIComponent(postalCode)}&datetime=${encodeURIComponent(utcDatetime)}`,
        );
        if (!res.ok) return undefined;
        const payload: unknown = await res.json();
        const data = weatherVerificationSchema.parse(payload);

        if (
            data.precipitationProbabilityPct === null ||
            data.windSpeedKmh === null ||
            data.temperatureCelsius === null
        ) {
            return undefined;
        }
        return {
            precipitationProbabilityPct: data.precipitationProbabilityPct,
            windSpeedKmh: data.windSpeedKmh,
            temperatureCelsius: data.temperatureCelsius,
        };
    } catch (error) {
        console.error("Silent weather fetch error:", error);
        return undefined;
    }
}
