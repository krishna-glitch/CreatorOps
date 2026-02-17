import logger from "@/server/utils/logger";
import {
  scheduleCheckRemindersJob,
  startCheckRemindersWorker,
} from "@/src/server/jobs/checkReminders";

async function main() {
  startCheckRemindersWorker();
  await scheduleCheckRemindersJob();

  logger.info("Reminder worker is running", {
    queue: "check-reminders",
    cron: "0 * * * *",
  });
}

main().catch((error) => {
  logger.error("Failed to start reminder worker", {
    error: error instanceof Error ? error.message : "Unknown error",
  });
  process.exit(1);
});
