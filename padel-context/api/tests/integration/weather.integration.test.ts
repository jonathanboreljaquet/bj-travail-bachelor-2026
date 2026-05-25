import { beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import app from "../../src/app";
import weatherService from "../../src/services/weather.service";

describe("[INTEGRATION TEST] GET /api/weather", () => {
    beforeAll(async () => {
        try {
            await weatherService.init();
        } catch (error) {
            console.error(
                "Failed to initialize WeatherService before integration tests:",
                error,
            );
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

    it("returns 200 and weather data for valid postal code and datetime", async () => {
        const response = await request(app).get("/api/weather").query({
            postalCode: "1262",
            datetime: "2026-05-12T17:00:00.000Z",
        });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("postalCode", "1262");
        expect(response.body).toHaveProperty("datetime", "202605121700");
        expect(response.body).toHaveProperty("precipitationProbabilityPct");
        expect(response.body).toHaveProperty("windSpeedKmh");
        expect(response.body).toHaveProperty("temperatureCelsius");
    });

    it("returns 200 and rounds datetime to full hour when minutes are present", async () => {
        const response = await request(app).get("/api/weather").query({
            postalCode: "1262",
            datetime: "2026-05-12T17:45:30.000Z",
        });

        expect(response.status).toBe(200);
        expect(response.body.datetime).toBe("202605121700");
    });
});
