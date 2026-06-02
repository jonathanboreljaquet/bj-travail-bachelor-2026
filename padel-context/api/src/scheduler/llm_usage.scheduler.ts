import cron from "node-cron";
import prisma from "../db";

/**
 * Initialise le planificateur (scheduler) pour la gestion des quotas LLM.
 * * Tâche planifiée :
 * - Déclenchement : Le 1er de chaque mois à minuit (00:00).
 * - Action : Réinitialise à 0 le compteur de tokens consommés (`currentMonthTokens`) pour TOUS les utilisateurs.
 */
export function initLlmUsageScheduler(): void {
    // Syntaxe cron : "0 0 1 * *" -> S'exécute le 1er de chaque mois à 00:00.
    // Référence : https://www.nodecron.com/cron-syntax.html
    cron.schedule("0 0 1 * *", async () => {
        try {
            await prisma.user.updateMany({
                data: {
                    currentMonthTokens: 0,
                },
            });

            console.log(
                `[LLM Usage Scheduler] Successfully reset tokens for all users`,
            );
        } catch (error) {
            console.error(
                "[LLM Usage Scheduler] Monthly token reset failed:",
                error,
            );
        }
    });

    console.log(
        "[LLM Usage Scheduler] Initialized - will reset tokens on the 1st of every month at 00:00",
    );
    return;
}
