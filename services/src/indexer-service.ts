/**
 * Indexer Service
 *
 * Monitors on-chain events (StablecoinInitialized, TokensMinted, TokensBurned,
 * BlacklistUpdated, etc.) and stores them for off-chain querying.
 */

import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import winston from "winston";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "indexer.log" }),
  ],
});

const PORT = parseInt(process.env.INDEXER_PORT || "3002");
const CLUSTER = process.env.SOLANA_CLUSTER || "devnet";
const PROGRAM_ID =
  process.env.SSS_PROGRAM_ID || "3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk";

// In-memory event store (use a DB in production: PostgreSQL, MongoDB, etc.)
interface IndexedEvent {
  signature: string;
  slot: number;
  blockTime: number | null;
  type: string;
  data: Record<string, any>;
}

const events: IndexedEvent[] = [];

const connection = new Connection(
  CLUSTER === "localnet"
    ? "http://127.0.0.1:8899"
    : clusterApiUrl(CLUSTER as any),
  "confirmed"
);

// ─── Event Listener ──────────────────────────────────────────

async function startListening() {
  const programId = new PublicKey(PROGRAM_ID);

  logger.info("Starting indexer", {
    programId: programId.toBase58(),
    cluster: CLUSTER,
  });

  // Subscribe to program logs
  connection.onLogs(
    programId,
    (logs) => {
      const { signature, logs: logMessages } = logs;

      // Parse Anchor events from log lines
      for (const log of logMessages) {
        if (log.startsWith("Program data:")) {
          const base64Data = log.replace("Program data: ", "");
          try {
            const event = parseAnchorEvent(base64Data);
            if (event) {
              const indexed: IndexedEvent = {
                signature,
                slot: 0,
                blockTime: Date.now(),
                type: event.type,
                data: event.data,
              };
              events.push(indexed);
              logger.info("Indexed event", {
                type: event.type,
                signature,
              });
            }
          } catch (e) {
            // Not all log lines are events
          }
        }
      }
    },
    "confirmed"
  );

  logger.info("Log subscription active");
}

// Simplified Anchor event parser
function parseAnchorEvent(
  base64Data: string
): { type: string; data: Record<string, any> } | null {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    // Anchor events have an 8-byte discriminator
    const discriminator = buffer.subarray(0, 8).toString("hex");

    // Map known discriminators to event types
    // In production, derive these from the IDL
    const eventMap: Record<string, string> = {
      // These would be computed from sha256("event:EventName")[..8]
    };

    const eventType = eventMap[discriminator] || "unknown";
    return {
      type: eventType,
      data: { raw: base64Data },
    };
  } catch {
    return null;
  }
}

// ─── REST API ────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    service: "indexer",
    cluster: CLUSTER,
    eventsIndexed: events.length,
  });
});

/**
 * Get all indexed events
 * GET /events?type=StablecoinInitialized&limit=50
 */
app.get("/events", (req, res) => {
  let filtered = [...events];

  if (req.query.type) {
    filtered = filtered.filter((e) => e.type === req.query.type);
  }

  const limit = parseInt((req.query.limit as string) || "50");
  filtered = filtered.slice(-limit);

  res.json({
    total: filtered.length,
    events: filtered,
  });
});

/**
 * Get events for a specific mint
 * GET /events/mint/:mint
 */
app.get("/events/mint/:mint", (req, res) => {
  const mint = req.params.mint;
  const filtered = events.filter(
    (e) => e.data.mint === mint || JSON.stringify(e.data).includes(mint)
  );

  res.json({
    mint,
    total: filtered.length,
    events: filtered,
  });
});

// ─── Start ───────────────────────────────────────────────────

app.listen(PORT, async () => {
  logger.info(`Indexer service started on port ${PORT}`);
  await startListening();
});

export default app;
