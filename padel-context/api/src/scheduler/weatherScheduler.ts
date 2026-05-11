import cron from "node-cron";
import weatherService from "../services/weatherService";

export function initWeatherScheduler(): void {
    //https://www.nodecron.com/cron-syntax.html
    cron.schedule("0 * * * *", async () => {
        try {
            await weatherService.executeWeatherTask();
        } catch (error) {
            console.error(
                "[Weather Scheduler] Hourly weather task execution failed:",
                error,
            );
        }
    });
    weatherService.executeWeatherTask().catch((error) => {
        console.error(
            "[Weather Scheduler] Initial weather task failed:",
            error,
        );
    });
    return;
}
