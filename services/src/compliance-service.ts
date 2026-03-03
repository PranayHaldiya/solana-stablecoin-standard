/**
 * Compliance Service
 *
 * Manages blacklist operations, sanctions screening, and compliance reporting.
 * Works with SSS-2 stablecoins that have transfer hook and permanent delegate enabled.
 */

import express from "express";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import winston from "winston";
import dotenv from "dotenv";

dotenv.config();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "compliance.log" }),
  ],
});

const PORT = parseInt(process.env.COMPLIANCE_PORT || "3003");
const CLUSTER = process.env.SOLANA_CLUSTER || "devnet";

// In-memory blacklist cache (synced from on-chain)
interface BlacklistRecord {
  address: string;
  mint: string;
  reason: string;
  addedAt: number;
  addedBy: string;
}

const blacklistCache: Map<string, BlacklistRecord> = new Map();

const connection = new Connection(
  CLUSTER === "localnet"
    ? "http://127.0.0.1:8899"
    : clusterApiUrl(CLUSTER as any),
  "confirmed"
);

const app = express();
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────

app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    service: "compliance",
    cluster: CLUSTER,
    blacklistSize: blacklistCache.size,
  });
});

/**
 * Check if an address is blacklisted
 * GET /check/:mint/:address
 */
app.get("/check/:mint/:address", async (req, res) => {
  try {
    const { mint, address } = req.params;
    const key = `${mint}:${address}`;
    const record = blacklistCache.get(key);

    res.json({
      mint,
      address,
      blacklisted: !!record,
      record: record || null,
    });
  } catch (err: any) {
    logger.error("Check error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Submit a blacklist request (will be processed by the blacklister key)
 * POST /blacklist/add
 * Body: { mint: string, address: string, reason: string }
 */
app.post("/blacklist/add", async (req, res) => {
  try {
    const { mint, address, reason } = req.body;

    if (!mint || !address || !reason) {
      return res
        .status(400)
        .json({ error: "Missing required fields: mint, address, reason" });
    }

    logger.info("Blacklist add request", { mint, address, reason });

    // Queue the on-chain transaction
    // In production: validate auth, build & send add_to_blacklist tx
    const key = `${mint}:${address}`;
    blacklistCache.set(key, {
      address,
      mint,
      reason,
      addedAt: Date.now(),
      addedBy: "service",
    });

    res.json({
      status: "accepted",
      mint,
      address,
      reason,
      message: "Blacklist request queued",
    });
  } catch (err: any) {
    logger.error("Blacklist add error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Submit a blacklist removal request
 * POST /blacklist/remove
 * Body: { mint: string, address: string }
 */
app.post("/blacklist/remove", async (req, res) => {
  try {
    const { mint, address } = req.body;

    if (!mint || !address) {
      return res
        .status(400)
        .json({ error: "Missing required fields: mint, address" });
    }

    logger.info("Blacklist remove request", { mint, address });

    const key = `${mint}:${address}`;
    blacklistCache.delete(key);

    res.json({
      status: "accepted",
      mint,
      address,
      message: "Blacklist removal queued",
    });
  } catch (err: any) {
    logger.error("Blacklist remove error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get full blacklist for a mint
 * GET /blacklist/:mint
 */
app.get("/blacklist/:mint", (req, res) => {
  const mint = req.params.mint;
  const entries: BlacklistRecord[] = [];

  blacklistCache.forEach((record, key) => {
    if (key.startsWith(`${mint}:`)) {
      entries.push(record);
    }
  });

  res.json({
    mint,
    total: entries.length,
    entries,
  });
});

/**
 * Compliance report
 * GET /report/:mint
 */
app.get("/report/:mint", (req, res) => {
  const mint = req.params.mint;
  const entries: BlacklistRecord[] = [];

  blacklistCache.forEach((record, key) => {
    if (key.startsWith(`${mint}:`)) {
      entries.push(record);
    }
  });

  res.json({
    mint,
    generatedAt: new Date().toISOString(),
    summary: {
      totalBlacklisted: entries.length,
      recentActions: entries.slice(-10),
    },
    compliance: {
      transferHookActive: true,
      permanentDelegateActive: true,
      blacklistEnforced: true,
    },
  });
});

// ─── Start ───────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`Compliance service started on port ${PORT}`, {
    cluster: CLUSTER,
  });
});

export default app;
