/**
 * Webhook Service
 *
 * Receives and dispatches webhooks for SSS events.
 * Supports configurable endpoints for mint, burn, freeze, blacklist events.
 */

import express from "express";
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
    new winston.transports.File({ filename: "webhook.log" }),
  ],
});

const PORT = parseInt(process.env.WEBHOOK_PORT || "3004");

// Webhook subscription store
interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  mint?: string;
  active: boolean;
  createdAt: number;
}

const subscriptions: Map<string, WebhookSubscription> = new Map();
let nextId = 1;

const app = express();
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────

app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    service: "webhook",
    subscriptions: subscriptions.size,
  });
});

/**
 * Register a webhook endpoint
 * POST /subscribe
 * Body: { url: string, events: string[], mint?: string }
 */
app.post("/subscribe", (req, res) => {
  try {
    const { url, events, mint } = req.body;

    if (!url || !events || !Array.isArray(events)) {
      return res
        .status(400)
        .json({ error: "Missing required: url (string), events (array)" });
    }

    const validEvents = [
      "StablecoinInitialized",
      "TokensMinted",
      "TokensBurned",
      "AccountFrozen",
      "AccountThawed",
      "Paused",
      "Unpaused",
      "BlacklistAdded",
      "BlacklistRemoved",
      "TokensSeized",
      "MinterUpdated",
      "RoleUpdated",
      "AuthorityTransferred",
    ];

    const invalidEvents = events.filter(
      (e: string) => !validEvents.includes(e)
    );
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        error: `Invalid events: ${invalidEvents.join(", ")}`,
        validEvents,
      });
    }

    const id = `wh_${nextId++}`;
    const subscription: WebhookSubscription = {
      id,
      url,
      events,
      mint,
      active: true,
      createdAt: Date.now(),
    };

    subscriptions.set(id, subscription);

    logger.info("Webhook registered", { id, url, events });

    res.json({
      status: "created",
      subscription,
    });
  } catch (err: any) {
    logger.error("Subscribe error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Unsubscribe a webhook
 * DELETE /subscribe/:id
 */
app.delete("/subscribe/:id", (req, res) => {
  const id = req.params.id;

  if (!subscriptions.has(id)) {
    return res.status(404).json({ error: "Subscription not found" });
  }

  subscriptions.delete(id);
  logger.info("Webhook unsubscribed", { id });

  res.json({ status: "deleted", id });
});

/**
 * List all subscriptions
 * GET /subscriptions
 */
app.get("/subscriptions", (_, res) => {
  const subs = Array.from(subscriptions.values());
  res.json({
    total: subs.length,
    subscriptions: subs,
  });
});

/**
 * Receive event from indexer (internal)
 * POST /dispatch
 * Body: { type: string, data: object }
 */
app.post("/dispatch", async (req, res) => {
  try {
    const { type, data } = req.body;

    logger.info("Dispatching event", { type });

    // Find matching subscriptions
    const matching = Array.from(subscriptions.values()).filter(
      (sub) =>
        sub.active &&
        sub.events.includes(type) &&
        (!sub.mint || sub.mint === data.mint)
    );

    // Dispatch to each subscriber
    const results = await Promise.allSettled(
      matching.map(async (sub) => {
        try {
          const response = await fetch(sub.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, data, timestamp: Date.now() }),
          });
          return { id: sub.id, status: response.status };
        } catch (err: any) {
          logger.error("Webhook dispatch failed", {
            id: sub.id,
            error: err.message,
          });
          return { id: sub.id, error: err.message };
        }
      })
    );

    res.json({
      type,
      dispatched: matching.length,
      results,
    });
  } catch (err: any) {
    logger.error("Dispatch error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ───────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`Webhook service started on port ${PORT}`);
});

export default app;
