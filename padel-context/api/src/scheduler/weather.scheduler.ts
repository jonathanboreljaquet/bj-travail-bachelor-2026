import cron from "node-cron";
import weatherService from "../services/weather.service";

export function initWeatherScheduler(): void {
    //https://www.nodecron.com/cron-syntax.html
    cron.schedule("*/10 * * * *", async () => {
        try {
            await weatherService.executeWeatherTask();
        } catch (error) {
            console.error(
                "[Weather Scheduler] 10 minutes weather task execution failed:",
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
