import { PublicKey, TransactionInstruction, Connection, AccountInfo } from "@solana/web3.js";
import BN from "bn.js";

/**
 * Oracle Program ID (devnet)
 */
export const SSS_ORACLE_PROGRAM_ID = new PublicKey(
  "E7U8UzJKqKaRBNVyeJ44kzBsuEf11TbjPETGeewzznLs"
);

/**
 * Oracle PDA seeds
 */
const ORACLE_SEED = Buffer.from("oracle");

/**
 * Derive the Oracle config PDA for a given mint
 */
export function findOracleConfigPDA(
  mint: PublicKey,
  programId: PublicKey = SSS_ORACLE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ORACLE_SEED, mint.toBuffer()],
    programId
  );
}

/**
 * Oracle configuration stored on-chain
 */
export interface OracleConfig {
  mint: PublicKey;
  authority: PublicKey;
  priceFeed: PublicKey;
  pegAsset: string;
  feedDecimals: number;
  stablecoinDecimals: number;
  maxStalenessSeconds: number;
  active: boolean;
  lastPrice: BN;
  lastUpdatedAt: BN;
  bump: number;
}

/**
 * Price data returned from the oracle
 */
export interface PriceData {
  price: BN;
  decimals: number;
  timestamp: BN;
  pegAsset: string;
}

/**
 * Computed amount returned from oracle
 */
export interface ComputedAmount {
  inputAmount: BN;
  outputAmount: BN;
  priceUsed: BN;
  priceDecimals: number;
}

/**
 * Oracle initialization parameters
 */
export interface OracleInitParams {
  priceFeed: PublicKey;
  pegAsset: string;
  feedDecimals: number;
  stablecoinDecimals: number;
  maxStalenessSeconds: number;
}

/**
 * Compute the expected mint amount from a collateral amount using oracle price.
 * This is a client-side helper that mirrors the on-chain computation.
 *
 * @param collateralAmount - Amount of collateral (in base units)
 * @param price - Oracle price (scaled by 10^feedDecimals)
 * @param feedDecimals - Decimals of the price feed
 * @returns The stablecoin amount to mint
 */
export function computeMintAmountFromOracle(
  collateralAmount: BN,
  price: BN,
  feedDecimals: number
): BN {
  const feedScale = new BN(10).pow(new BN(feedDecimals));
  return collateralAmount.mul(price).div(feedScale);
}

/**
 * Compute the expected collateral output from a stablecoin burn.
 *
 * @param stablecoinAmount - Amount of stablecoins to redeem (in base units)
 * @param price - Oracle price (scaled by 10^feedDecimals)
 * @param feedDecimals - Decimals of the price feed
 * @returns The collateral amount to release
 */
export function computeRedeemAmountFromOracle(
  stablecoinAmount: BN,
  price: BN,
  feedDecimals: number
): BN {
  const feedScale = new BN(10).pow(new BN(feedDecimals));
  return stablecoinAmount.mul(feedScale).div(price);
}

/**
 * Parse oracle config from raw account data (Anchor format).
 * Skips 8-byte discriminator.
 */
export function parseOracleConfig(data: Buffer): OracleConfig {
  let offset = 8; // skip discriminator

  const mint = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const authority = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const priceFeed = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  // Borsh string: 4-byte length + bytes
  const pegAssetLen = data.readUInt32LE(offset);
  offset += 4;
  const pegAsset = data.subarray(offset, offset + pegAssetLen).toString("utf8");
  offset += pegAssetLen;

  const feedDecimals = data.readUInt8(offset);
  offset += 1;

  const stablecoinDecimals = data.readUInt8(offset);
  offset += 1;

  const maxStalenessSeconds = new BN(data.subarray(offset, offset + 8), "le").toNumber();
  offset += 8;

  const active = data.readUInt8(offset) === 1;
  offset += 1;

  const lastPrice = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const lastUpdatedAt = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const bump = data.readUInt8(offset);

  return {
    mint,
    authority,
    priceFeed,
    pegAsset,
    feedDecimals,
    stablecoinDecimals,
    maxStalenessSeconds,
    active,
    lastPrice,
    lastUpdatedAt,
    bump,
  };
}

/**
 * Fetch and parse oracle config from the network
 */
export async function fetchOracleConfig(
  connection: Connection,
  mint: PublicKey,
  programId: PublicKey = SSS_ORACLE_PROGRAM_ID
): Promise<OracleConfig | null> {
  const [oraclePDA] = findOracleConfigPDA(mint, programId);
  const accountInfo = await connection.getAccountInfo(oraclePDA);

  if (!accountInfo) return null;

  return parseOracleConfig(accountInfo.data as Buffer);
}
