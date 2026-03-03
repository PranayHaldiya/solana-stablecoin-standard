import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// ─── Program IDs ─────────────────────────────────────────────

export const SSS_TOKEN_PROGRAM_ID = new PublicKey(
  "3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk"
);

export const SSS_TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  "J8sRn7M35NfUi511JY3Hnw4dPBm9UvwmpKCBrAbzCMKq"
);

// ─── On-chain account types (decoded from Anchor) ────────────

export interface StablecoinConfig {
  authority: PublicKey;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
  transferHookProgram: PublicKey;
  pauser: PublicKey;
  blacklister: PublicKey;
  seizer: PublicKey;
  paused: boolean;
  totalMinted: BN;
  totalBurned: BN;
  bump: number;
}

export interface MinterConfig {
  stablecoin: PublicKey;
  minter: PublicKey;
  quota: BN;
  minted: BN;
  active: boolean;
  bump: number;
}

export interface BlacklistEntry {
  stablecoin: PublicKey;
  address: PublicKey;
  reason: string;
  createdAt: BN;
  blacklistedBy: PublicKey;
  bump: number;
}

// ─── Instruction argument types ──────────────────────────────

export interface StablecoinInitArgs {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
  transferHookProgram?: PublicKey;
}

export enum RoleType {
  Pauser = "Pauser",
  Blacklister = "Blacklister",
  Seizer = "Seizer",
}

// ─── SDK Result types ────────────────────────────────────────

export interface TransactionResult {
  signature: string;
}

export interface MintResult extends TransactionResult {
  amount: BN;
  recipient: PublicKey;
}

export interface BurnResult extends TransactionResult {
  amount: BN;
}

export interface InitResult extends TransactionResult {
  mint: PublicKey;
  stablecoinConfig: PublicKey;
  preset: "SSS-1" | "SSS-2";
}

export interface SeizeResult extends TransactionResult {
  amount: BN;
  from: PublicKey;
  to: PublicKey;
}

// ─── Preset types ────────────────────────────────────────────

export type PresetName = "SSS-1" | "SSS-2";

export interface PresetConfig {
  name: PresetName;
  description: string;
  defaults: Omit<StablecoinInitArgs, "name" | "symbol" | "uri">;
  features: string[];
}

// ─── Supply info ─────────────────────────────────────────────

export interface SupplyInfo {
  totalMinted: BN;
  totalBurned: BN;
  currentSupply: BN;
  decimals: number;
}

// ─── Error codes (mirroring on-chain) ────────────────────────

export enum StablecoinErrorCode {
  Unauthorized = 6000,
  Paused = 6001,
  NotPaused = 6002,
  QuotaExceeded = 6003,
  MinterNotActive = 6004,
  AlreadyBlacklisted = 6005,
  NotBlacklisted = 6006,
  NotSSS2 = 6007,
  ZeroAmount = 6008,
  MathOverflow = 6009,
  NameTooLong = 6010,
  SymbolTooLong = 6011,
  UriTooLong = 6012,
  InvalidDecimals = 6013,
  InvalidConfig = 6014,
}
