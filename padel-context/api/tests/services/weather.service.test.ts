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
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("[UNIT TEST] WeatherService", () => {
    const mockCsvContent = `point_id;col2;col3;postal_code
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
        readFileMock.mockResolvedValueOnce(mockCsvContent);

        await weatherService.init();

        expect(readFileMock).toHaveBeenCalledTimes(1);
        expect(readFileMock.mock.calls[0][1]).toBe("utf-8");
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
});
