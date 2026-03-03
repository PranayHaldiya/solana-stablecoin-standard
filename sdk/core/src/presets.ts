import { PresetConfig, PresetName } from "./types";

/**
 * SSS-1: Minimal Stablecoin
 *
 * Features:
 * - Mint authority (via PDA with role-based minters)
 * - Freeze authority
 * - Token metadata (name, symbol, uri)
 * - Pause/unpause operations
 * - Per-minter quotas
 *
 * Use cases: simple stablecoins, DAO treasury tokens, wrapped assets
 */
const SSS_1: PresetConfig = {
  name: "SSS-1",
  description: "Minimal stablecoin – mint + freeze + metadata + pause",
  defaults: {
    decimals: 6,
    enablePermanentDelegate: false,
    enableTransferHook: false,
    defaultAccountFrozen: false,
  },
  features: [
    "mint_authority",
    "freeze_authority",
    "metadata",
    "role_based_access",
    "per_minter_quotas",
    "pause_unpause",
  ],
};

/**
 * SSS-2: Compliant Stablecoin
 *
 * Everything in SSS-1 plus:
 * - Permanent delegate (token seizure capability)
 * - Transfer hook (on-chain blacklist enforcement)
 * - Blacklist management
 * - Token seizure via permanent delegate
 * - Optional default-frozen accounts (KYC gating)
 *
 * Use cases: USDC/USDT-class regulated tokens, CBDC pilots, compliant RWA tokens
 */
const SSS_2: PresetConfig = {
  name: "SSS-2",
  description:
    "Compliant stablecoin – SSS-1 + permanent delegate + transfer hook + blacklist",
  defaults: {
    decimals: 6,
    enablePermanentDelegate: true,
    enableTransferHook: true,
    defaultAccountFrozen: false,
  },
  features: [
    "mint_authority",
    "freeze_authority",
    "metadata",
    "role_based_access",
    "per_minter_quotas",
    "pause_unpause",
    "permanent_delegate",
    "transfer_hook",
    "blacklist",
    "token_seizure",
  ],
};

/**
 * Presets namespace providing standard stablecoin configurations.
 *
 * @example
 * ```typescript
 * import { Presets } from "@stbr/sss-token";
 *
 * // Use SSS-1 minimal config
 * const coin = await stablecoin.create({
 *   ...Presets.SSS_1.defaults,
 *   name: "My USD",
 *   symbol: "MUSD",
 *   uri: "https://example.com/metadata.json",
 * });
 * ```
 */
export const Presets = {
  SSS_1,
  SSS_2,

  /**
   * Get preset by name string.
   */
  get(name: PresetName): PresetConfig {
    switch (name) {
      case "SSS-1":
        return SSS_1;
      case "SSS-2":
        return SSS_2;
      default:
        throw new Error(`Unknown preset: ${name}`);
    }
  },

  /**
   * List all available presets.
   */
  list(): PresetConfig[] {
    return [SSS_1, SSS_2];
  },
};
