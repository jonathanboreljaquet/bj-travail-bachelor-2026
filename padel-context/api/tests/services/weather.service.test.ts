import {
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    jest,
} from "@jest/globals";

const readFileMock =
    jest.fn<(path: string, encoding: string) => Promise<string>>();

await jest.unstable_mockModule("fs/promises", () => ({
    default: {
        readFile: readFileMock,
    },
    readFile: readFileMock,
}));

let weatherService: typeof import("../../src/services/weather.service").default;

beforeAll(async () => {
    ({ default: weatherService } =
        await import("../../src/services/weather.service"));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("[UNIT TEST] WeatherService", () => {
    const mockMetaPointCsvContent = `point_id;col2;col3;postal_code
                                     1;null;null;1200
                                     2;null;null;1202
                                     3;null;null;1203`;

    it("returns undefined if searching for a postal code before initialization", () => {
        const result = weatherService.getPointIdFromPostalCode("75001");

        expect(result).toBeUndefined();
        expect(readFileMock).not.toHaveBeenCalled();
    });

    it("throws an error if reading the CSV file fails during initialization", async () => {
        readFileMock.mockRejectedValueOnce(new Error("File not found"));

        await expect(weatherService.init()).rejects.toThrow("File not found");
    });

    it("successfully initializes the service and caches the CSV data", async () => {
        readFileMock.mockResolvedValueOnce(mockMetaPointCsvContent);

        await weatherService.init();

        expect(readFileMock).toHaveBeenCalledTimes(1);
    });

    it("does not read the file from disk again if init() is called multiple times", async () => {
        await weatherService.init();

        expect(readFileMock).not.toHaveBeenCalled();
    });

    it("returns the correct point_id for an existing postal code", () => {
        const result = weatherService.getPointIdFromPostalCode("1202");

        expect(result).toBe("2");
    });

    it("returns undefined for a postal code that does not exist in the file", () => {
        const result = weatherService.getPointIdFromPostalCode("99999");

        expect(result).toBeUndefined();
    });

    it("returns precipitation, wind and temperature for a postal code and datetime", async () => {
        await weatherService.init();

        const result = await weatherService.getWeatherDataForPostalCode(
            "1202",
            "202605142200",
        );

        expect(result).toBeDefined();

        expect(result).toHaveProperty("precipitation");
        expect(result).toHaveProperty("wind");
        expect(result).toHaveProperty("temperature");
    });

    it("throws if dateTime is not in YYYYMMDDHHmm format", async () => {
        await expect(
            weatherService.getWeatherDataForPostalCode("1202", "2026-05-14"),
        ).rejects.toThrow("Invalid dateTime format");
    });

    it("throws when no point_id exists for the postal code", async () => {
        await expect(
            weatherService.getWeatherDataForPostalCode("99999", "202605142200"),
        ).rejects.toThrow("No point_id found for postal code");
    });
});
