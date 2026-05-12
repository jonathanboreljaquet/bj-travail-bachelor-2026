import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

interface StacAsset {
    type: string;
    href: string;
    created: string;
    updated: string;
    "file:checksum"?: string;
}

interface StacItem {
    id: string;
    assets: Record<string, StacAsset>;
}

class WeatherService {
    private readonly baseUrl =
        "https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-local-forecasting/items";
    private readonly storageDirectory = path.join(
        process.cwd(),
        "data",
        "weather-forecasts",
    );

    private itemEtag: string | null = null;
    private assetEtags: Record<string, string | null> = {
        temperature: null,
        precipitation: null,
        wind: null,
    };

    // https://opendatadocs.meteoswiss.ch/e-forecast-data/e4-local-forecast-data#data-structure
    private readonly assetCodes = {
        temperature: "tre200h0",
        precipitation: "rre150h0",
        wind: "fu3010h0",
    };

    constructor() {
        this.initializeStorage();
    }

    private async initializeStorage(): Promise<void> {
        try {
            await fs.mkdir(this.storageDirectory, { recursive: true });
        } catch (error) {
            console.error(
                "[WeatherService] Failed to create storage directory:",
                error,
            );
        }
    }

    private getCurrentDateString(): string {
        // MétéoSuisse rolls its daily folders based on the UTC timezone, not local Swiss time.
        const now = new Date();

        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, "0");
        const day = String(now.getUTCDate()).padStart(2, "0");

        return `${year}${month}${day}`;
    }

    private findLatestAssetByCode(
        assetsObj: Record<string, StacAsset>,
        code: string,
    ): StacAsset | null {
        const entries = Object.entries(assetsObj);

        const filteredEntries = entries.filter(([key]) => key.includes(code));

        if (filteredEntries.length === 0) {
            return null;
        }

        filteredEntries.sort(
            (a, b) =>
                new Date(b[1].created).getTime() -
                new Date(a[1].created).getTime(),
        );

        return filteredEntries[0][1];
    }

    private validateChecksum(
        buffer: Buffer,
        expectedChecksum?: string,
    ): boolean {
        if (!expectedChecksum) {
            return true;
        }

        const hash = crypto.createHash("sha256").update(buffer).digest("hex");

        const expectedRawHash = expectedChecksum.startsWith("1220")
            ? expectedChecksum.substring(4)
            : expectedChecksum;

        return hash === expectedRawHash;
    }

    private async downloadAndStoreAsset(
        asset: StacAsset,
        category: keyof typeof this.assetCodes,
    ): Promise<void> {
        const headers: HeadersInit = {};
        const savedEtag = this.assetEtags[category];

        if (savedEtag) {
            headers["If-None-Match"] = savedEtag;
        }

        const response = await fetch(asset.href, { headers });

        if (response.status === 304) {
            console.log(
                `[WeatherService] Asset [${category}] has not changed (304 Not Modified).`,
            );
            return;
        }

        if (response.status !== 200) {
            throw new Error(
                `Failed to fetch asset [${category}]. HTTP Status: ${response.status}`,
            );
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const isValid = this.validateChecksum(buffer, asset["file:checksum"]);

        if (!isValid) {
            throw new Error(
                `[WeatherService] Checksum validation failed for asset [${category}]. Data might be corrupted.`,
            );
        }

        const newEtag = response.headers.get("ETag");
        if (newEtag) {
            this.assetEtags[category] = newEtag;
        }

        const fileName = `${category}_latest.csv`;
        const filePath = path.join(this.storageDirectory, fileName);
        await fs.writeFile(filePath, buffer);

        console.log(
            `[WeatherService] Successfully downloaded and verified new asset: ${fileName}`,
        );
    }

    public async executeWeatherTask(): Promise<void> {
        const dateStr = this.getCurrentDateString();
        const itemUrl = `${this.baseUrl}/${dateStr}-ch`;

        const headers: HeadersInit = {};
        if (this.itemEtag) {
            headers["If-None-Match"] = this.itemEtag;
        }

        try {
            const response = await fetch(itemUrl, { headers });

            if (response.status === 304) {
                console.log(
                    "[WeatherService] STAC Item metadata has not changed (304 Not Modified).",
                );
                return;
            }

            if (response.status !== 200) {
                console.error(
                    `[WeatherService] Failed to fetch STAC item. HTTP Status: ${response.status}`,
                );
                return;
            }

            const newEtag = response.headers.get("ETag");
            if (newEtag) {
                this.itemEtag = newEtag;
            }

            const itemData = (await response.json()) as StacItem;

            if (!itemData.assets) {
                console.warn(
                    "[WeatherService] No assets found in the STAC item.",
                );
                return;
            }

            for (const [category, code] of Object.entries(this.assetCodes)) {
                const latestAsset = this.findLatestAssetByCode(
                    itemData.assets,
                    code,
                );

                if (latestAsset) {
                    await this.downloadAndStoreAsset(
                        latestAsset,
                        category as keyof typeof this.assetCodes,
                    );
                } else {
                    console.warn(
                        `[WeatherService] No asset found for category: ${category} (code: ${code})`,
                    );
                }
            }
        } catch (error) {
            console.error("[WeatherService] Execution error:", error);
            throw error;
        }
    }
}

export default new WeatherService();
