import {
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    jest,
} from "@jest/globals";
import type { Request, Response } from "express";

const getWeatherDataForPostalCodeMock = jest.fn<
    (
        postalCode: string,
        datetime: string,
    ) => Promise<{
        precipitation: number | null;
        wind: number | null;
        temperature: number | null;
    }>
>();

const parseDateMock = jest.fn<(value: unknown) => Date | null>();

await jest.unstable_mockModule("../../src/services/weather.service", () => ({
    default: {
        getWeatherDataForPostalCode: getWeatherDataForPostalCodeMock,
    },
}));

await jest.unstable_mockModule("../../src/utils/helper", () => ({
    parseDate: parseDateMock,
}));

let getWeather: typeof import("../../src/controllers/weather.controller").getWeather;

beforeAll(async () => {
    ({ getWeather } = await import("../../src/controllers/weather.controller"));
});

afterEach(() => {
    jest.clearAllMocks();
});

const createMockResponse = () => {
    const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    };

    return response as unknown as Response;
};

const createMockRequest = (query: Record<string, unknown> = {}) =>
    ({
        query,
    }) as Request;

describe("[UNIT TEST] getWeather", () => {
    it("returns 400 when postalCode is invalid", async () => {
        parseDateMock.mockReturnValueOnce(new Date("2026-05-14T22:00:00Z"));

        const request = createMockRequest({
            postalCode: "12A2",
            datetime: "2026-05-14T22:00:00.000Z",
        });
        const response = createMockResponse();

        await getWeather(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "postalCode must be exactly 4 digits",
        });
        expect(getWeatherDataForPostalCodeMock).not.toHaveBeenCalled();
    });

    it("returns 400 when datetime is invalid (parseDate returns null)", async () => {
        parseDateMock.mockReturnValueOnce(null);

        const request = createMockRequest({
            postalCode: "1202",
            datetime: "invalid-date",
        });
        const response = createMockResponse();

        await getWeather(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            message: "datetime is required",
        });
        expect(getWeatherDataForPostalCodeMock).not.toHaveBeenCalled();
    });

    it("parses ISO datetime, rounds to full hour, and returns weather data", async () => {
        parseDateMock.mockReturnValueOnce(new Date("2026-05-14T22:30:00Z"));
        getWeatherDataForPostalCodeMock.mockResolvedValueOnce({
            precipitation: 0.4,
            wind: 11.2,
            temperature: 19.7,
        });

        const request = createMockRequest({
            postalCode: "1202",
            datetime: "2026-05-14T22:30:00.000Z",
        });
        const response = createMockResponse();

        await getWeather(request, response);

        expect(parseDateMock).toHaveBeenCalledWith("2026-05-14T22:30:00.000Z");
        expect(getWeatherDataForPostalCodeMock).toHaveBeenCalledWith(
            "1202",
            "202605142200",
        );
        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith({
            postalCode: "1202",
            datetime: "202605142200",
            precipitation: 0.4,
            wind: 11.2,
            temperature: 19.7,
        });
    });

    it("returns 404 when no point_id exists for postal code", async () => {
        parseDateMock.mockReturnValueOnce(new Date("2026-05-14T22:00:00Z"));
        getWeatherDataForPostalCodeMock.mockRejectedValueOnce(
            new Error(
                "[WeatherService] No point_id found for postal code: 9999",
            ),
        );

        const request = createMockRequest({
            postalCode: "9999",
            datetime: "2026-05-14T22:00:00.000Z",
        });
        const response = createMockResponse();

        await getWeather(request, response);

        expect(response.status).toHaveBeenCalledWith(404);
        expect(response.json).toHaveBeenCalledWith({
            message: "[WeatherService] No point_id found for postal code: 9999",
        });
    });

    it("returns 500 when an unexpected error occurs", async () => {
        parseDateMock.mockReturnValueOnce(new Date("2026-05-14T22:00:00Z"));
        getWeatherDataForPostalCodeMock.mockRejectedValueOnce(
            new Error("unexpected failure"),
        );

        const request = createMockRequest({
            postalCode: "1202",
            datetime: "2026-05-14T22:00:00.000Z",
        });
        const response = createMockResponse();

        await getWeather(request, response);

        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith({
            message: "Error while fetching weather",
            error: expect.any(Error),
        });
    });
});
