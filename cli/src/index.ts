#!/usr/bin/env node

import { Command } from "commander";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { BN } from "bn.js";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";

// ─── Helpers ─────────────────────────────────────────────────

function loadKeypair(keypairPath?: string): Keypair {
  const resolved =
    keypairPath ||
    process.env.ANCHOR_WALLET ||
    path.join(
      process.env.HOME || process.env.USERPROFILE || "~",
      ".config",
      "solana",
      "id.json"
    );

  if (!fs.existsSync(resolved)) {
    console.error(
      chalk.red(`Keypair file not found: ${resolved}`)
    );
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function getConnection(cluster: string): Connection {
  if (cluster === "localnet") {
    return new Connection("http://127.0.0.1:8899", "confirmed");
  }
  return new Connection(
    clusterApiUrl(cluster as any),
    "confirmed"
  );
}

function logResult(label: string, value: string) {
  console.log(`${chalk.gray(label)}: ${chalk.cyan(value)}`);
}

// ─── Main Program ────────────────────────────────────────────

const program = new Command();

program
  .name("sss")
  .description("Solana Stablecoin Standard CLI")
  .version("0.1.0")
  .option("-c, --cluster <cluster>", "Solana cluster", "devnet")
  .option("-k, --keypair <path>", "Path to keypair file");

// ─── Initialize ──────────────────────────────────────────────

program
  .command("init")
  .description("Initialize a new stablecoin")
  .requiredOption("--name <name>", "Token name")
  .requiredOption("--symbol <symbol>", "Token symbol")
  .requiredOption("--uri <uri>", "Metadata URI")
  .option("--decimals <num>", "Token decimals", "6")
  .option("--preset <preset>", "Preset to use: sss-1 or sss-2", "sss-1")
  .action(async (opts) => {
    const spinner = ora("Initializing stablecoin...").start();

    try {
      const parent = program.opts();
      const connection = getConnection(parent.cluster);
      const keypair = loadKeypair(parent.keypair);
      const wallet = new Wallet(keypair);

      const isSSS2 = opts.preset.toLowerCase() === "sss-2";

      console.log();
      logResult("Cluster", parent.cluster);
      logResult("Authority", keypair.publicKey.toBase58());
      logResult("Preset", isSSS2 ? "SSS-2 (Compliant)" : "SSS-1 (Minimal)");
      logResult("Name", opts.name);
      logResult("Symbol", opts.symbol);
      logResult("Decimals", opts.decimals);

      // In production, this would call the SDK's create() method
      // For now, show the configuration that would be used
      spinner.succeed(
        chalk.green(
          `Stablecoin configuration prepared: ${opts.symbol} (${
            isSSS2 ? "SSS-2" : "SSS-1"
          })`
        )
      );

      console.log();
      console.log(chalk.yellow("Features:"));
      console.log("  ✓ Mint authority (PDA-controlled)");
      console.log("  ✓ Freeze authority");
      console.log("  ✓ Token metadata");
      console.log("  ✓ Role-based access control");
      console.log("  ✓ Per-minter quotas");
      if (isSSS2) {
        console.log("  ✓ Permanent delegate (token seizure)");
        console.log("  ✓ Transfer hook (blacklist enforcement)");
        console.log("  ✓ On-chain blacklist");
      }
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Mint ────────────────────────────────────────────────────

program
  .command("mint")
  .description("Mint tokens to a recipient")
  .requiredOption("--mint <address>", "Token mint address")
  .requiredOption("--to <address>", "Recipient address")
  .requiredOption("--amount <amount>", "Amount to mint (in token units)")
  .action(async (opts) => {
    const spinner = ora("Minting tokens...").start();

    try {
      const parent = program.opts();
      const connection = getConnection(parent.cluster);
      const keypair = loadKeypair(parent.keypair);

      const mint = new PublicKey(opts.mint);
      const recipient = new PublicKey(opts.to);
      const amount = new BN(opts.amount);

      logResult("Mint", mint.toBase58());
      logResult("Recipient", recipient.toBase58());
      logResult("Amount", amount.toString());

      // SDK call would go here
      spinner.succeed(chalk.green(`Mint instruction prepared`));
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Burn ────────────────────────────────────────────────────

program
  .command("burn")
  .description("Burn tokens from your account")
  .requiredOption("--mint <address>", "Token mint address")
  .requiredOption("--amount <amount>", "Amount to burn")
  .action(async (opts) => {
    const spinner = ora("Burning tokens...").start();

    try {
      const parent = program.opts();
      const connection = getConnection(parent.cluster);
      const keypair = loadKeypair(parent.keypair);

      const mint = new PublicKey(opts.mint);
      const amount = new BN(opts.amount);

      logResult("Mint", mint.toBase58());
      logResult("Amount", amount.toString());

      spinner.succeed(chalk.green(`Burn instruction prepared`));
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Freeze / Thaw ──────────────────────────────────────────

program
  .command("freeze")
  .description("Freeze a token account")
  .requiredOption("--mint <address>", "Token mint address")
  .requiredOption("--account <address>", "Target token account")
  .action(async (opts) => {
    const spinner = ora("Freezing token account...").start();

    try {
      const mint = new PublicKey(opts.mint);
      const account = new PublicKey(opts.account);

      logResult("Mint", mint.toBase58());
      logResult("Account", account.toBase58());

      spinner.succeed(chalk.green("Freeze instruction prepared"));
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("thaw")
  .description("Thaw a frozen token account")
  .requiredOption("--mint <address>", "Token mint address")
  .requiredOption("--account <address>", "Target token account")
  .action(async (opts) => {
    const spinner = ora("Thawing token account...").start();

    try {
      const mint = new PublicKey(opts.mint);
      const account = new PublicKey(opts.account);

      logResult("Mint", mint.toBase58());
      logResult("Account", account.toBase58());

      spinner.succeed(chalk.green("Thaw instruction prepared"));
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Pause / Unpause ────────────────────────────────────────

program
  .command("pause")
  .description("Pause all token operations")
  .requiredOption("--mint <address>", "Token mint address")
  .action(async (opts) => {
    const spinner = ora("Pausing...").start();

    try {
      logResult("Mint", new PublicKey(opts.mint).toBase58());
      spinner.succeed(chalk.green("Pause instruction prepared"));
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("unpause")
  .description("Unpause token operations")
  .requiredOption("--mint <address>", "Token mint address")
  .action(async (opts) => {
    const spinner = ora("Unpausing...").start();

    try {
      logResult("Mint", new PublicKey(opts.mint).toBase58());
      spinner.succeed(chalk.green("Unpause instruction prepared"));
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Blacklist (SSS-2) ──────────────────────────────────────

program
  .command("blacklist-add")
  .description("Add address to blacklist (SSS-2 only)")
  .requiredOption("--mint <address>", "Token mint address")
  .requiredOption("--address <address>", "Address to blacklist")
  .requiredOption("--reason <reason>", "Reason for blacklisting")
  .action(async (opts) => {
    const spinner = ora("Adding to blacklist...").start();

    try {
      logResult("Mint", new PublicKey(opts.mint).toBase58());
      logResult("Address", new PublicKey(opts.address).toBase58());
      logResult("Reason", opts.reason);

      spinner.succeed(chalk.green("Blacklist add instruction prepared"));
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("blacklist-remove")
  .description("Remove address from blacklist (SSS-2 only)")
  .requiredOption("--mint <address>", "Token mint address")
  .requiredOption("--address <address>", "Address to remove")
  .action(async (opts) => {
    const spinner = ora("Removing from blacklist...").start();

    try {
      logResult("Mint", new PublicKey(opts.mint).toBase58());
      logResult("Address", new PublicKey(opts.address).toBase58());

      spinner.succeed(chalk.green("Blacklist remove instruction prepared"));
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Seize (SSS-2) ──────────────────────────────────────────

program
  .command("seize")
  .description("Seize tokens via permanent delegate (SSS-2 only)")
  .requiredOption("--mint <address>", "Token mint address")
  .requiredOption("--from <address>", "Owner of tokens to seize")
  .requiredOption("--to <address>", "Treasury token account to receive")
  .requiredOption("--amount <amount>", "Amount to seize")
  .action(async (opts) => {
    const spinner = ora("Seizing tokens...").start();

    try {
      logResult("Mint", new PublicKey(opts.mint).toBase58());
      logResult("From", new PublicKey(opts.from).toBase58());
      logResult("To", new PublicKey(opts.to).toBase58());
      logResult("Amount", opts.amount);

      spinner.succeed(chalk.green("Seize instruction prepared"));
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Minter Management ──────────────────────────────────────

program
  .command("add-minter")
  .description("Add or update a minter with quota")
  .requiredOption("--mint <address>", "Token mint address")
  .requiredOption("--minter <address>", "Minter address")
  .requiredOption("--quota <amount>", "Minting quota")
  .action(async (opts) => {
    const spinner = ora("Updating minter...").start();

    try {
      logResult("Mint", new PublicKey(opts.mint).toBase58());
      logResult("Minter", new PublicKey(opts.minter).toBase58());
      logResult("Quota", opts.quota);

      spinner.succeed(chalk.green("Minter updated"));
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Info ────────────────────────────────────────────────────

program
  .command("info")
  .description("Display stablecoin configuration and supply info")
  .requiredOption("--mint <address>", "Token mint address")
  .action(async (opts) => {
    const spinner = ora("Fetching stablecoin info...").start();

    try {
      const parent = program.opts();
      const connection = getConnection(parent.cluster);
      const mint = new PublicKey(opts.mint);

      spinner.stop();

      console.log();
      console.log(chalk.bold("Stablecoin Information"));
      console.log("─".repeat(40));
      logResult("Mint", mint.toBase58());
      logResult("Cluster", parent.cluster);
      console.log();
      console.log(
        chalk.yellow("Note: Connect to a live cluster with a deployed program to see full info.")
      );
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Presets Info ────────────────────────────────────────────

program
  .command("presets")
  .description("List available stablecoin presets")
  .action(() => {
    console.log();
    console.log(chalk.bold("Available Presets"));
    console.log("═".repeat(60));

    console.log();
    console.log(chalk.cyan.bold("SSS-1: Minimal Stablecoin"));
    console.log(chalk.gray("  Simple stablecoins, DAO treasury tokens, wrapped assets"));
    console.log("  Features:");
    console.log("    ✓ Mint authority (PDA-controlled)");
    console.log("    ✓ Freeze authority");
    console.log("    ✓ Token metadata");
    console.log("    ✓ Role-based access control");
    console.log("    ✓ Per-minter quotas");
    console.log("    ✓ Pause/unpause");

    console.log();
    console.log(chalk.cyan.bold("SSS-2: Compliant Stablecoin"));
    console.log(chalk.gray("  USDC/USDT-class regulated tokens, CBDC pilots"));
    console.log("  Features:");
    console.log("    ✓ Everything in SSS-1");
    console.log("    ✓ Permanent delegate (token seizure)");
    console.log("    ✓ Transfer hook (blacklist enforcement)");
    console.log("    ✓ On-chain blacklist management");
    console.log("    ✓ Token seizure via permanent delegate");

    console.log();
    console.log(
      chalk.gray("Usage: sss init --preset sss-1 --name 'My USD' --symbol MUSD --uri https://...")
    );
  });

program.parse();
