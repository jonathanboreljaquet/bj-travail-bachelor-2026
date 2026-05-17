import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import app from "../../src/app";
import weatherService from "../../src/services/weather.service";

describe("[INTEGRATION TEST] GET /api/weather", () => {
    const fixtureDir = path.join(process.cwd(), "tests/fixtures/weather");
    const dataDir = path.join(process.cwd(), "data/weather-forecasts");
    const csvFiles = [
        "precipitation_latest.csv",
        "wind_latest.csv",
        "temperature_latest.csv",
    ];

    beforeAll(async () => {
        await weatherService.init();

        try {
            await fs.mkdir(dataDir, { recursive: true });
            for (const file of csvFiles) {
                const source = path.join(fixtureDir, file);
                const dest = path.join(dataDir, file);
                await fs.copyFile(source, dest);
            }
        } catch (error) {
            console.error("Failed to setup weather fixtures:", error);
            throw error;
        }
    });

    afterAll(async () => {
        try {
            for (const file of csvFiles) {
                const dest = path.join(dataDir, file);
                await fs.unlink(dest);
            }
        } catch (error) {
            console.error("Failed to cleanup weather fixtures:", error);
        }
    });

    it("returns 400 when postalCode is invalid (not 4 digits)", async () => {
        const response = await request(app).get("/api/weather").query({
            postalCode: "ABC",
            datetime: "2026-05-12T17:00:00.000Z",
        });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            message: "postalCode must be exactly 4 digits",
        });
    });

    it("returns 400 when datetime is missing or invalid", async () => {
        const response = await request(app).get("/api/weather").query({
            postalCode: "1262",
        });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            message: "datetime is required",
        });
    });

    it("returns 404 when postal code is not found in map", async () => {
        const response = await request(app).get("/api/weather").query({
            postalCode: "9999",
            datetime: "2026-05-12T17:00:00.000Z",
        });

        expect(response.status).toBe(404);
        expect(response.body.message).toContain("No point_id found");
    });

    it("returns weather data for valid postal code and datetime", async () => {
        const response = await request(app).get("/api/weather").query({
            postalCode: "1262",
            datetime: "2026-05-12T17:00:00.000Z",
        });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("postalCode", "1262");
        expect(response.body).toHaveProperty("datetime", "202605121700");
        expect(response.body).toHaveProperty("precipitation");
        expect(response.body).toHaveProperty("wind");
        expect(response.body).toHaveProperty("temperature");

        expect(typeof response.body.precipitation).toBe("number");
        expect(typeof response.body.wind).toBe("number");
        expect(typeof response.body.temperature).toBe("number");

        expect(response.body.precipitation).toBe(0.2);
        expect(response.body.wind).toBe(9.2);
        expect(response.body.temperature).toBe(18.5);
    });

    it("rounds datetime to full hour when minutes are present", async () => {
        const response = await request(app).get("/api/weather").query({
            postalCode: "1262",
            datetime: "2026-05-12T17:45:30.000Z",
        });

        expect(response.status).toBe(200);
        expect(response.body.datetime).toBe("202605121700");
        expect(response.body.precipitation).toBe(0.2);
        expect(response.body.wind).toBe(9.2);
        expect(response.body.temperature).toBe(18.5);
    });

    it("returns null values when data point not found in CSV", async () => {
        const response = await request(app).get("/api/weather").query({
            postalCode: "1262",
            datetime: "2026-05-15T12:00:00.000Z",
        });

        expect(response.status).toBe(200);
        expect(response.body.datetime).toBe("202605151200");
        expect(response.body.precipitation).toBeNull();
        expect(response.body.wind).toBeNull();
        expect(response.body.temperature).toBeNull();
    });
});
