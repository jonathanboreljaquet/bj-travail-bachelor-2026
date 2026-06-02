/**
 * Convertit une chaîne de caractères représentant une heure (ex: "14:30")
 * en un nombre total de minutes depuis minuit (ex: 870).
 * @param {string} time - L'heure au format "HH:MM".
 * @returns {number} Le nombre total de minutes.
 */
export const toMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};

/**
 * Crée un nouvel objet Date en appliquant un nombre spécifique de minutes
 * (depuis minuit UTC) à une date de base.
 * Utile pour générer les créneaux horaires dynamiques (slots) d'un terrain.
 * @param {Date} baseDate - La date de référence (le jour ciblé).
 * @param {number} minutes - Le temps à appliquer en minutes (ex: 540 pour 09:00).
 * @returns {Date} La nouvelle date avec l'heure exacte.
 */
export const toDateAtMinutes = (baseDate: Date, minutes: number): Date => {
    const result = new Date(baseDate);
    result.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return result;
};

/**
 * Convertit une chaîne ("true"/"false") en booléen.
 * @param {unknown} value - La valeur brute (ex: req.query.hasEquipmentBox).
 * @returns {boolean | undefined} Le booléen, ou undefined si la valeur est absente ou invalide.
 */
export const parseBoolean = (value: unknown): boolean | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }

    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === "true") {
        return true;
    }
    if (normalizedValue === "false") {
        return false;
    }

    return undefined;
};

/**
 * Convertit une chaîne en nombre.
 * @param {unknown} value - La valeur brute (ex: req.query.slotDuration).
 * @returns {number | undefined} Le nombre valide, ou undefined si ce n'est pas un nombre.
 */
export const parseNumber = (value: unknown): number | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }

    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
        return undefined;
    }

    return numberValue;
};

/**
 * Convertit une chaîne de caractères en objet Date.
 * @param {unknown} value - La valeur brute.
 * @returns {Date | undefined} L'objet Date, ou undefined si la date est invalide.
 */
export const parseDate = (value: unknown): Date | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }

    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
        return undefined;
    }

    return dateValue;
};

/**
 * Normalise une chaîne pour faciliter les comparaisons.
 * Supprime les accents, trémas, cédilles, et convertit tout en minuscules.
 * Ex: "Genève" -> "geneve", "Thônex" -> "thonex".
 * @param {string} str - La chaîne originale.
 * @returns {string} La chaîne normalisée.
 */
export const normalizeString = (str: string): string => {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

/**
 * Parse et sécurise le nombre de tokens LLM.
 * S'assure que la valeur est un nombre fini, positif et sans décimales.
 * @param {unknown} value - La valeur brute.
 * @returns {number | undefined} Le nombre entier positif, ou undefined.
 */
export const parseTokenValue = (value: unknown): number | undefined => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return undefined;
    }

    return Math.max(0, Math.trunc(value));
};

/**
 * Le nombre maximum de matchs futurs auxquels un utilisateur peut s'inscrire simultanément.
 * Valeur par défaut : 5 (si la variable d'environnement est absente ou invalide).
 */
export const MAX_UPCOMING_MATCHES = (() => {
    const envValue = parseNumber(process.env.MAX_UPCOMING_MATCHES);
    const isValid =
        envValue !== undefined && Number.isInteger(envValue) && envValue > 0;

    return isValid ? envValue : 5;
})();

/**
 * Message d'erreur standard renvoyé à l'utilisateur s'il dépasse sa limite de réservations.
 */
export const MAX_UPCOMING_MATCHES_MESSAGE = `You cannot participate in more than ${MAX_UPCOMING_MATCHES} upcoming matches at the same time`;
