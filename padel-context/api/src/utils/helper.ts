export const toMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};

export const toDateAtMinutes = (baseDate: Date, minutes: number): Date => {
    const result = new Date(baseDate);
    result.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return result;
};

export const parseStatus = (value: unknown): string => {
    if (typeof value !== "string") {
        return "OPEN";
    }

    const normalizedStatus = value.trim().toUpperCase();
    if (
        normalizedStatus === "OPEN" ||
        normalizedStatus === "COMPLETED" ||
        normalizedStatus === "CANCELED"
    ) {
        return normalizedStatus;
    }

    return "OPEN";
};

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

export const parseDateOnly = (value: unknown): Date | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }

    const match = /^\d{4}-\d{2}-\d{2}$/.exec(value.trim());
    if (!match) {
        return undefined;
    }

    const date = new Date(`${value.trim()}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
        return undefined;
    }

    return date;
};