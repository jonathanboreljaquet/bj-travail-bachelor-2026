import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STAC_API_URL =
    "https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-local-forecasting/items";

// https://opendatadocs.meteoswiss.ch/e-forecast-data/e4-local-forecast-data#data-structure
const WEATHER_IDENTIFIERS = {
    temperature: "tre200h0",
    precipitation: "rre150h0",
    wind: "fu3010h0",
};

const DATA_DIR = path.join(__dirname, "../../data/weather-forecasts");

interface WeatherFile {
    code: string;
    url: string;
    filename: string;
    timestamp: string;
}

interface StacAsset {
    type: string;
    href: string;
    created?: string;
    updated?: string;
    "file:checksum"?: string;
}

interface StacFeature {
    id: string;
    assets: Record<string, StacAsset>;
}

interface StacResponse {
    features: StacFeature[];
}

class WeatherService {
    async fetchLatestWeatherFiles(): Promise<WeatherFile[]> {
        console.log("[Weather] Fetching latest weather files from STAC API...");

        try {
            const response = await fetch(STAC_API_URL);

            if (!response.ok) {
                throw new Error(`STAC API returned ${response.status}`);
            }

            const data: StacResponse = await response.json();

            let latestFeature: StacFeature | null = null;

            for (let i = data.features.length - 1; i >= 0; i--) {
                const currentFeature = data.features[i];

                if (currentFeature && currentFeature.assets) {
                    const aDesFichiersMeteo = Object.keys(
                        currentFeature.assets,
                    ).some((filename) =>
                        filename.includes(WEATHER_IDENTIFIERS.temperature),
                    );

                    if (aDesFichiersMeteo) {
                        latestFeature = currentFeature;
                        break;
                    }
                }
            }

            if (!latestFeature) {
                throw new Error(
                    "No valid features with weather assets found in STAC API response",
                );
            }

            console.log(`[Weather] Processing feature: ${latestFeature.id}`);

            const weatherFiles: WeatherFile[] = [];

            for (const [code, codeValue] of Object.entries(
                WEATHER_IDENTIFIERS,
            )) {
                const file = this.findLatestFileByCode(
                    latestFeature.assets,
                    codeValue,
                );
                if (file) {
                    weatherFiles.push(file);
                    console.log(
                        `[Weather] Found ${code}: ${file.filename} (${file.timestamp})`,
                    );
                } else {
                    console.warn(
                        `[Weather] No file found for code: ${codeValue}`,
                    );
                }
            }

            return weatherFiles;
        } catch (error) {
            console.error("[Weather] Error fetching STAC API:", error);
            throw error;
        }
    }

    private findLatestFileByCode(
        assets: Record<string, StacAsset>,
        code: string,
    ): WeatherFile | null {
        let latestFile: WeatherFile | null = null;
        let latestTimestamp = "";

        for (const [filename, asset] of Object.entries(assets)) {
            if (filename.includes(code)) {
                const timestampMatch = filename.match(/(\d{12})/);
                if (timestampMatch) {
                    const timestamp = timestampMatch[1];
                    if (timestamp > latestTimestamp) {
                        latestTimestamp = timestamp;
                        latestFile = {
                            code,
                            url: asset.href,
                            filename,
                            timestamp,
                        };
                    }
                }
            }
        }

        return latestFile;
    }

    async downloadAndSaveFiles(files: WeatherFile[]): Promise<void> {
        await fs.mkdir(DATA_DIR, { recursive: true });

        for (const file of files) {
            const filePath = path.join(DATA_DIR, file.filename);

            try {
                await fs.access(filePath);
                console.log(
                    `[Weather] Already up to date : ${file.filename}. Download skipped.`,
                );
                continue;
            } catch {
                // The file does not exist. We will download it.
            }

            try {
                console.log(`[Weather] Downloading ${file.filename}...`);
                const response = await fetch(file.url);

                if (!response.ok) {
                    throw new Error(
                        `Download failed with status ${response.status}`,
                    );
                }

                const buffer = await response.arrayBuffer();
                await fs.writeFile(filePath, Buffer.from(buffer));
                console.log(`[Weather] Saved: ${filePath}`);
            } catch (error) {
                console.error(
                    `[Weather] Error downloading ${file.filename}:`,
                    error,
                );
                throw error;
            }
        }
    }

    private async cleanupOldFiles(currentFiles: WeatherFile[]): Promise<void> {
        try {
            const validFilenames = currentFiles.map((file) => file.filename);
            validFilenames.push("latest_forecasts.json");

            const existingFiles = await fs.readdir(DATA_DIR);

            for (const file of existingFiles) {
                if (!validFilenames.includes(file)) {
                    const filePath = path.join(DATA_DIR, file);
                    await fs.unlink(filePath);
                    console.log(`[Weather] Cleaning : delete of ${file}`);
                }
            }
        } catch (error) {
            console.error("[Weather] Error during cleanup:", error);
        }
    }

    private async saveStateFile(currentFiles: WeatherFile[]): Promise<void> {
        const statePath = path.join(DATA_DIR, "latest_forecasts.json");

        const state = {
            updatedAt: new Date().toISOString(),
            files: {
                temperature: currentFiles.find(
                    (f) => f.code === WEATHER_IDENTIFIERS.temperature,
                )?.filename,
                precipitation: currentFiles.find(
                    (f) => f.code === WEATHER_IDENTIFIERS.precipitation,
                )?.filename,
                wind: currentFiles.find(
                    (f) => f.code === WEATHER_IDENTIFIERS.wind,
                )?.filename,
            },
        };

        await fs.writeFile(statePath, JSON.stringify(state, null, 2));
        console.log("[Weather] latest_forecasts.json file updated");
    }

    async executeWeatherTask(): Promise<void> {
        try {
            const files = await this.fetchLatestWeatherFiles();

            if (files.length > 0) {
                await this.downloadAndSaveFiles(files);
                await this.cleanupOldFiles(files);
                await this.saveStateFile(files);

                console.log(
                    `[Weather] Successfully processed ${files.length} weather files`,
                );
            } else {
                console.warn("[Weather] No weather files found to process");
            }
        } catch (error) {
            console.error("[Weather] Weather task failed:", error);
            throw error;
        }
    }
}

export default new WeatherService();
