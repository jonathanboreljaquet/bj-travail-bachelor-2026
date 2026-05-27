import cron from "node-cron";
import prisma from "../db";

export function initLlmUsageScheduler(): void {
    //https://www.nodecron.com/cron-syntax.html
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
