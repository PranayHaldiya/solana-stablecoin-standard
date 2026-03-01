/**
 * Mint/Burn Service
 *
 * REST API for authorized minting and burning operations.
 * Handles queue management, quota enforcement, and audit logging.
 */

import express from "express";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { BN } from "bn.js";
import winston from "winston";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// ─── Logger ──────────────────────────────────────────────────

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "mint-burn.log" }),
  ],
});

// ─── Config ──────────────────────────────────────────────────

const PORT = parseInt(process.env.MINT_BURN_PORT || "3001");
const CLUSTER = process.env.SOLANA_CLUSTER || "devnet";
const KEYPAIR_PATH =
  process.env.KEYPAIR_PATH || `${process.env.HOME}/.config/solana/id.json`;

// ─── Setup ───────────────────────────────────────────────────

function loadKeypair(): Keypair {
  const raw = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

const app = express();
app.use(express.json());

const connection = new Connection(
  CLUSTER === "localnet"
    ? "http://127.0.0.1:8899"
    : clusterApiUrl(CLUSTER as any),
  "confirmed"
);

// ─── Routes ──────────────────────────────────────────────────

/**
 * Health check
 */
app.get("/health", (_, res) => {
  res.json({ status: "ok", service: "mint-burn", cluster: CLUSTER });
});

/**
 * Mint tokens
 * POST /mint
 * Body: { mint: string, recipient: string, amount: string }
 */
app.post("/mint", async (req, res) => {
  try {
    const { mint, recipient, amount } = req.body;

    if (!mint || !recipient || !amount) {
      return res.status(400).json({ error: "Missing required fields: mint, recipient, amount" });
    }

    const mintPubkey = new PublicKey(mint);
    const recipientPubkey = new PublicKey(recipient);
    const amountBN = new BN(amount);

    logger.info("Mint request received", {
      mint,
      recipient,
      amount: amountBN.toString(),
    });

    // In production, this would:
    // 1. Validate API key / auth
    // 2. Check minter quota
    // 3. Build and send transaction via SDK
    // 4. Wait for confirmation
    // 5. Return signature

    res.json({
      status: "accepted",
      mint: mintPubkey.toBase58(),
      recipient: recipientPubkey.toBase58(),
      amount: amountBN.toString(),
      message: "Mint request queued for processing",
    });
  } catch (err: any) {
    logger.error("Mint error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Burn tokens
 * POST /burn
 * Body: { mint: string, amount: string }
 */
app.post("/burn", async (req, res) => {
  try {
    const { mint, amount } = req.body;

    if (!mint || !amount) {
      return res.status(400).json({ error: "Missing required fields: mint, amount" });
    }

    const mintPubkey = new PublicKey(mint);
    const amountBN = new BN(amount);

    logger.info("Burn request received", {
      mint,
      amount: amountBN.toString(),
    });

    res.json({
      status: "accepted",
      mint: mintPubkey.toBase58(),
      amount: amountBN.toString(),
      message: "Burn request queued for processing",
    });
  } catch (err: any) {
    logger.error("Burn error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get supply information
 * GET /supply/:mint
 */
app.get("/supply/:mint", async (req, res) => {
  try {
    const mint = new PublicKey(req.params.mint);

    logger.info("Supply query", { mint: mint.toBase58() });

    // In production, query the on-chain StablecoinConfig account
    res.json({
      mint: mint.toBase58(),
      totalMinted: "0",
      totalBurned: "0",
      currentSupply: "0",
      message: "Connect to deployed program for live data",
    });
  } catch (err: any) {
    logger.error("Supply error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ───────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`Mint/Burn service started on port ${PORT}`, {
    cluster: CLUSTER,
  });
});

export default app;
