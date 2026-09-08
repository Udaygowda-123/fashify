/**
 * Replays the stock ledger for every variant and reports any that disagree
 * with the stored counters.
 *
 *   npm run reconcile
 *   npm run reconcile -- --verbose
 *
 * Exits non-zero when anything has drifted, so it can be a cron check or a CI
 * step rather than something a person has to remember to look at.
 */
import { logger } from "../lib/logger.js";
import { connectMongo, disconnectMongo } from "../lib/mongo.js";
import { reconcile } from "../services/inventory.service.js";

async function main(): Promise<void> {
  const verbose = process.argv.includes("--verbose");
  await connectMongo();

  const rows = await reconcile();
  const drifted = rows.filter((row) => !row.ok);

  if (verbose) {
    for (const row of rows.slice(0, 20)) {
      logger.info(
        {
          sku: row.sku,
          onHand: `${row.storedOnHand} stored / ${row.ledgerOnHand} ledger`,
          reserved: `${row.storedReserved} stored / ${row.ledgerReserved} ledger`,
        },
        row.ok ? "ok" : "DRIFT",
      );
    }
  }

  if (drifted.length === 0) {
    logger.info({ variants: rows.length }, "ledger reconciles for every variant");
    await disconnectMongo();
    return;
  }

  for (const row of drifted) {
    logger.error(
      {
        sku: row.sku,
        variantId: row.variantId,
        onHandDrift: row.onHandDrift,
        reservedDrift: row.reservedDrift,
      },
      "stock has drifted from its ledger",
    );
  }
  logger.error(
    { drifted: drifted.length, checked: rows.length },
    "reconciliation failed",
  );
  await disconnectMongo();
  process.exit(1);
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "reconciliation could not run");
  process.exit(1);
});
