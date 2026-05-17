import { Request, Response } from "express";
import { parseDate } from "../utils/helper";
import weatherService from "../services/weather.service";

const POSTAL_CODE_REGEX = /^\d{4}$/;

function formatCompactDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = "00";
    return `${year}${month}${day}${hours}${minutes}`;
}

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
