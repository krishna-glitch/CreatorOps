import { z } from "zod";
import {
  enqueueCheckRemindersJob,
  runCheckRemindersJob,
  scheduleCheckRemindersJob,
} from "@/src/server/jobs/checkReminders";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const jobsRouter = createTRPCRouter({
  checkReminders: protectedProcedure
    .input(
      z
        .object({
          mode: z.enum(["run_now", "enqueue", "schedule"]).default("run_now"),
        })
        .optional(),
    )
    .mutation(async ({ input }) => {
      const mode = input?.mode ?? "run_now";

      if (mode === "schedule") {
        await scheduleCheckRemindersJob();
        return {
          ok: true,
          mode,
        };
      }

      if (mode === "enqueue") {
        const job = await enqueueCheckRemindersJob();
        return {
          ok: true,
          mode,
          job,
        };
      }

      const result = await runCheckRemindersJob();
      return {
        ok: true,
        mode,
        result,
      };
    }),
});
