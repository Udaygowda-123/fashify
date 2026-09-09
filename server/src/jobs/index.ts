import cron, { type ScheduledTask } from "node-cron";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { sendEmail } from "../lib/mailer.js";
import { withLock } from "../lib/redis.js";
import { getLowStock } from "../services/admin.service.js";
import { LowStockDigest } from "../emails/templates.js";
import { runAbandonedBagSweepLocked } from "./abandoned-bag.js";
import { runBackInStockSweep } from "./notify-back-in-stock.js";
import { runReservationSweep } from "./release-expired-reservations.js";

/**
 * The daily digest of everything at or below its reorder point.
 *
 * This exists because the alternative is finding out from a shopper: the
 * best-selling size sells through, nobody notices, and the piece quietly stops
 * earning until someone happens to look at the stock list.
 */
export async function runLowStockDigest(): Promise<{ rows: number; sent: boolean }> {
  const rows = await getLowStock();
  if (rows.length === 0) {
    logger.info("low-stock digest: nothing to report");
    return { rows: 0, sent: false };
  }

  if (!env.ADMIN_ALERT_EMAIL) {
    logger.warn({ rows: rows.length }, "low-stock digest not sent: ADMIN_ALERT_EMAIL is unset");
    return { rows: rows.length, sent: false };
  }

  const result = await sendEmail({
    to: env.ADMIN_ALERT_EMAIL,
    subject: `${rows.length} sizes need reordering`,
    kind: "low-stock-digest",
    element: LowStockDigest({
      rows: rows.map((row) => ({
        productName: row.productName,
        sku: row.sku,
        size: row.size,
        colour: row.colour,
        available: row.available,
        lowStockThreshold: row.lowStockThreshold,
      })),
    }),
  });

  return { rows: rows.length, sent: result.sent };
}

const tasks: ScheduledTask[] = [];

/**
 * Every schedule is wrapped so a thrown job logs and the next run still
 * happens — an unhandled rejection inside a cron tick would otherwise take the
 * process down and stop every other job with it.
 */
function schedule(name: string, expression: string, run: () => Promise<unknown>): void {
  const task = cron.schedule(expression, () => {
    void run().catch((error: unknown) => {
      logger.error({ err: error, job: name }, "scheduled job failed");
    });
  });
  tasks.push(task);
  logger.info({ job: name, cron: expression }, "job scheduled");
}

export function startJobs(): void {
  if (!env.ENABLE_JOBS) {
    logger.warn("ENABLE_JOBS is false, so no scheduled work will run");
    return;
  }

  /**
   * Every minute. This one is not optional: it is what stops abandoned bags
   * holding stock forever, and a TTL index cannot do its job — see the comment
   * in release-expired-reservations.ts.
   */
  schedule("release-expired-reservations", "* * * * *", runReservationSweep);

  // Every fifteen minutes: picks up stock that reappeared from a return or a
  // cancellation rather than an admin restock.
  schedule("notify-back-in-stock", "*/15 * * * *", () =>
    withLock("sweep:back-in-stock", 10 * 60_000, runBackInStockSweep),
  );

  // Hourly, but each bag is only ever reminded once.
  schedule("abandoned-bag-reminders", "7 * * * *", runAbandonedBagSweepLocked);

  // 07:30 IST, so it is in the inbox before the day starts.
  schedule("low-stock-digest", "0 2 * * *", () =>
    withLock("digest:low-stock", 30 * 60_000, runLowStockDigest),
  );
}

export function stopJobs(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
}
