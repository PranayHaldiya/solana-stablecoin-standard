import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Wallet, BN } from "@coral-xyz/anchor";

import {
  TransactionResult,
  SeizeResult,
  BlacklistEntry,
  SSS_TOKEN_PROGRAM_ID,
} from "./types";
import {
  findStablecoinConfigPDA,
  findBlacklistEntryPDA,
} from "./pda";

export interface ComplianceModuleOptions {
  connection: Connection;
  wallet: Wallet;
  programId?: PublicKey;
}

/**
 * Compliance module for SSS-2 stablecoins.
 *
 * Provides blacklist management and token seizure capabilities
 * that are only available when permanent delegate and transfer
 * hook extensions are enabled.
 *
 * @example
 * ```typescript
 * import { ComplianceModule } from "@stbr/sss-token";
 *
 * const compliance = new ComplianceModule({
 *   connection,
 *   wallet,
 * });
 *
 * // Add address to blacklist
 * await compliance.addToBlacklist(mint, badActor, "Sanctions compliance");
 *
 * // Seize tokens from blacklisted account
 * await compliance.seize(mint, badActor, treasuryAta, new BN(1_000_000));
 * ```
 */
export class ComplianceModule {
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly programId: PublicKey;

  constructor(opts: ComplianceModuleOptions) {
    this.connection = opts.connection;
    this.wallet = opts.wallet;
    this.programId = opts.programId ?? SSS_TOKEN_PROGRAM_ID;
  }

  // ─── Blacklist Management ──────────────────────────────────

  /**
   * Add an address to the blacklist. Requires blacklister role.
   */
  async addToBlacklist(
    mintAddress: PublicKey,
    address: PublicKey,
    reason: string
  ): Promise<TransactionResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );
    const [blacklistEntry] = findBlacklistEntryPDA(
      stablecoinConfig,
      address,
      this.programId
    );

    const discriminator = Buffer.from([
      47, 163, 16, 10, 55, 205, 114, 162, // "add_to_blacklist"
    ]);

    // Serialize: discriminator + pubkey + string(4-byte len + utf8)
    const addressBuf = address.toBuffer();
    const reasonBuf = Buffer.from(reason, "utf-8");
    const reasonLenBuf = Buffer.alloc(4);
    reasonLenBuf.writeUInt32LE(reasonBuf.length, 0);

    const data = Buffer.concat([
      discriminator,
      addressBuf,
      reasonLenBuf,
      reasonBuf,
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: stablecoinConfig, isSigner: false, isWritable: false },
        { pubkey: blacklistEntry, isSigner: false, isWritable: true },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature };
  }

  /**
   * Remove an address from the blacklist. Requires blacklister role.
   */
  async removeFromBlacklist(
    mintAddress: PublicKey,
    address: PublicKey
  ): Promise<TransactionResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );
    const [blacklistEntry] = findBlacklistEntryPDA(
      stablecoinConfig,
      address,
      this.programId
    );

    const discriminator = Buffer.from([
      198, 100, 83, 12, 121, 53, 230, 27, // "remove_from_blacklist"
    ]);

    const data = Buffer.concat([discriminator, address.toBuffer()]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: stablecoinConfig, isSigner: false, isWritable: false },
        { pubkey: blacklistEntry, isSigner: false, isWritable: true },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature };
  }

  // ─── Token Seizure ─────────────────────────────────────────

  /**
   * Seize tokens from a blacklisted/frozen account using the permanent delegate.
   * Requires seizer role.
   */
  async seize(
    mintAddress: PublicKey,
    fromOwner: PublicKey,
    treasuryAta: PublicKey,
    amount: BN
  ): Promise<SeizeResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );

    const fromAta = getAssociatedTokenAddressSync(
      mintAddress,
      fromOwner,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const discriminator = Buffer.from([
      133, 56, 233, 21, 41, 226, 167, 37, // "seize"
    ]);

    const data = Buffer.concat([
      discriminator,
      amount.toArrayLike(Buffer, "le", 8),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: stablecoinConfig, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        { pubkey: fromAta, isSigner: false, isWritable: true },
        { pubkey: treasuryAta, isSigner: false, isWritable: true },
        {
          pubkey: TOKEN_2022_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature, amount, from: fromAta, to: treasuryAta };
  }

  // ─── Query Operations ─────────────────────────────────────

  /**
   * Check if an address is blacklisted.
   */
  async isBlacklisted(
    mintAddress: PublicKey,
    address: PublicKey
  ): Promise<boolean> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );
    const [blacklistEntry] = findBlacklistEntryPDA(
      stablecoinConfig,
      address,
      this.programId
    );

    const info = await this.connection.getAccountInfo(blacklistEntry);
    return info !== null;
  }

  /**
   * Get blacklist entry details for an address.
   */
  async getBlacklistEntry(
    mintAddress: PublicKey,
    address: PublicKey
  ): Promise<BlacklistEntry | null> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );
    const [blacklistPDA] = findBlacklistEntryPDA(
      stablecoinConfig,
      address,
      this.programId
    );

    const info = await this.connection.getAccountInfo(blacklistPDA);
    if (!info) return null;

    return this.decodeBlacklistEntry(info.data);
  }

  private decodeBlacklistEntry(data: Buffer): BlacklistEntry {
    let offset = 8; // skip discriminator

    const stablecoin = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const address = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const reasonLen = data.readUInt32LE(offset);
    offset += 4;
    const reason = data.subarray(offset, offset + reasonLen).toString("utf-8");
    offset += reasonLen;

    const createdAt = new BN(data.subarray(offset, offset + 8), "le");
    offset += 8;

    const blacklistedBy = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const bump = data[offset];

    return {
      stablecoin,
      address,
      reason,
      createdAt,
      blacklistedBy,
      bump,
    };
  }
}
