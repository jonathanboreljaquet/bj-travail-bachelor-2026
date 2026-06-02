import cron from "node-cron";
import weatherService from "../services/weather.service";

/**
 * Initialise le planificateur (scheduler) pour la mise à jour des données météorologiques.
 * * Comportement :
 * 1. Planifie une mise à jour récurrente (toutes les 10 minutes).
 * 2. Lance une première mise à jour immédiatement pour ne pas démarrer à vide.
 */
export function initWeatherScheduler(): void {
    // Syntaxe cron : "*/10 * * * *" -> S'exécute toutes les 10 minutes.
    // Référence : https://www.nodecron.com/cron-syntax.html
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

    console.log(
        "[Weather Scheduler] Initialized - will execute weather task every 10 minutes",
    );
    return;
}
