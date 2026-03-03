import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeTransferHookInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getMintLen,
  ExtensionType,
  createInitializeDefaultAccountStateInstruction,
  AccountState,
} from "@solana/spl-token";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";

import {
  StablecoinConfig,
  StablecoinInitArgs,
  InitResult,
  MintResult,
  BurnResult,
  SupplyInfo,
  RoleType,
  TransactionResult,
  SSS_TOKEN_PROGRAM_ID,
  SSS_TRANSFER_HOOK_PROGRAM_ID,
} from "./types";
import {
  findStablecoinConfigPDA,
  findMinterConfigPDA,
  findBlacklistEntryPDA,
  findExtraAccountMetaListPDA,
} from "./pda";

// Anchor IDL will be loaded dynamically or bundled
// For now we use a simplified interface
export interface SolanaStablecoinOptions {
  connection: Connection;
  wallet: Wallet;
  programId?: PublicKey;
  transferHookProgramId?: PublicKey;
}

/**
 * Main SDK class for interacting with the Solana Stablecoin Standard programs.
 *
 * @example
 * ```typescript
 * import { SolanaStablecoin, Presets } from "@stbr/sss-token";
 *
 * const sdk = new SolanaStablecoin({
 *   connection,
 *   wallet,
 * });
 *
 * // Create an SSS-1 minimal stablecoin
 * const result = await sdk.create({
 *   ...Presets.SSS_1.defaults,
 *   name: "My USD",
 *   symbol: "MUSD",
 *   uri: "https://example.com/metadata.json",
 * });
 *
 * console.log("Mint:", result.mint.toBase58());
 * ```
 */
export class SolanaStablecoin {
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly programId: PublicKey;
  readonly transferHookProgramId: PublicKey;
  private provider: AnchorProvider;

  constructor(opts: SolanaStablecoinOptions) {
    this.connection = opts.connection;
    this.wallet = opts.wallet;
    this.programId = opts.programId ?? SSS_TOKEN_PROGRAM_ID;
    this.transferHookProgramId =
      opts.transferHookProgramId ?? SSS_TRANSFER_HOOK_PROGRAM_ID;
    this.provider = new AnchorProvider(this.connection, this.wallet, {
      commitment: "confirmed",
    });
  }

  // ─── Token Creation ─────────────────────────────────────────

  /**
   * Create a new Token-2022 mint with the proper extensions,
   * then call the on-chain `initialize` instruction to register
   * the stablecoin configuration PDA.
   */
  async create(args: StablecoinInitArgs): Promise<InitResult> {
    const mint = Keypair.generate();
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mint.publicKey,
      this.programId
    );

    // Determine required extensions
    const extensions: ExtensionType[] = [];
    if (args.enablePermanentDelegate) {
      extensions.push(ExtensionType.PermanentDelegate);
    }
    if (args.enableTransferHook) {
      extensions.push(ExtensionType.TransferHook);
    }
    if (args.defaultAccountFrozen) {
      extensions.push(ExtensionType.DefaultAccountState);
    }

    const mintLen = getMintLen(extensions);
    const lamports = await this.connection.getMinimumBalanceForRentExemption(
      mintLen
    );

    const tx = new Transaction();

    // 1. Create mint account
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: this.wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      })
    );

    // 2. Initialize extensions BEFORE InitializeMint
    if (args.enablePermanentDelegate) {
      tx.add(
        createInitializePermanentDelegateInstruction(
          mint.publicKey,
          stablecoinConfig, // PDA is the permanent delegate
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    if (args.enableTransferHook) {
      const hookProgram =
        args.transferHookProgram ?? this.transferHookProgramId;
      tx.add(
        createInitializeTransferHookInstruction(
          mint.publicKey,
          stablecoinConfig, // PDA is the hook authority
          hookProgram,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    if (args.defaultAccountFrozen) {
      tx.add(
        createInitializeDefaultAccountStateInstruction(
          mint.publicKey,
          AccountState.Frozen,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    // 3. Initialize mint with PDA as mint authority and freeze authority
    tx.add(
      createInitializeMintInstruction(
        mint.publicKey,
        args.decimals,
        stablecoinConfig, // Mint authority = PDA
        stablecoinConfig, // Freeze authority = PDA
        TOKEN_2022_PROGRAM_ID
      )
    );

    // 4. Call on-chain initialize
    tx.add(
      await this.buildInitializeInstruction(
        mint.publicKey,
        stablecoinConfig,
        args
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer, mint],
      { commitment: "confirmed" }
    );

    const preset = args.enablePermanentDelegate || args.enableTransferHook
      ? "SSS-2" as const
      : "SSS-1" as const;

    return {
      signature,
      mint: mint.publicKey,
      stablecoinConfig,
      preset,
    };
  }

  // ─── Mint Tokens ────────────────────────────────────────────

  /**
   * Mint tokens to a recipient. Caller must be an authorized minter.
   */
  async mint(
    mintAddress: PublicKey,
    recipient: PublicKey,
    amount: BN
  ): Promise<MintResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );
    const [minterConfig] = findMinterConfigPDA(
      stablecoinConfig,
      this.wallet.publicKey,
      this.programId
    );

    const recipientAta = getAssociatedTokenAddressSync(
      mintAddress,
      recipient,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new Transaction();

    // Create recipient ATA if needed
    tx.add(
      createAssociatedTokenAccountInstruction(
        this.wallet.publicKey,
        recipientAta,
        recipient,
        mintAddress,
        TOKEN_2022_PROGRAM_ID
      )
    );

    tx.add(
      await this.buildMintInstruction(
        mintAddress,
        stablecoinConfig,
        minterConfig,
        recipientAta,
        amount
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature, amount, recipient };
  }

  // ─── Burn Tokens ────────────────────────────────────────────

  /**
   * Burn tokens from the caller's account.
   */
  async burn(mintAddress: PublicKey, amount: BN): Promise<BurnResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );

    const burnerAta = getAssociatedTokenAddressSync(
      mintAddress,
      this.wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new Transaction();
    tx.add(
      await this.buildBurnInstruction(
        mintAddress,
        stablecoinConfig,
        burnerAta,
        amount
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature, amount };
  }

  // ─── Freeze / Thaw ─────────────────────────────────────────

  /**
   * Freeze a token account.
   */
  async freeze(
    mintAddress: PublicKey,
    targetAccount: PublicKey
  ): Promise<TransactionResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );

    const tx = new Transaction();
    tx.add(
      await this.buildFreezeInstruction(
        mintAddress,
        stablecoinConfig,
        targetAccount,
        true
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature };
  }

  /**
   * Thaw a frozen token account.
   */
  async thaw(
    mintAddress: PublicKey,
    targetAccount: PublicKey
  ): Promise<TransactionResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );

    const tx = new Transaction();
    tx.add(
      await this.buildFreezeInstruction(
        mintAddress,
        stablecoinConfig,
        targetAccount,
        false
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature };
  }

  // ─── Pause / Unpause ───────────────────────────────────────

  async pause(mintAddress: PublicKey): Promise<TransactionResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );
    const tx = new Transaction();
    tx.add(
      await this.buildAdminInstruction("pause", stablecoinConfig)
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature };
  }

  async unpause(mintAddress: PublicKey): Promise<TransactionResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );
    const tx = new Transaction();
    tx.add(
      await this.buildAdminInstruction("unpause", stablecoinConfig)
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature };
  }

  // ─── Role Management ───────────────────────────────────────

  /**
   * Update a minter's quota and active status.
   */
  async updateMinter(
    mintAddress: PublicKey,
    minter: PublicKey,
    quota: BN,
    active: boolean
  ): Promise<TransactionResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );
    const [minterConfig] = findMinterConfigPDA(
      stablecoinConfig,
      minter,
      this.programId
    );

    const tx = new Transaction();
    tx.add(
      await this.buildUpdateMinterInstruction(
        stablecoinConfig,
        minterConfig,
        minter,
        quota,
        active
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature };
  }

  /**
   * Update a role (pauser, blacklister, or seizer).
   */
  async updateRole(
    mintAddress: PublicKey,
    role: RoleType,
    account: PublicKey
  ): Promise<TransactionResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );

    const tx = new Transaction();
    tx.add(
      await this.buildUpdateRolesInstruction(stablecoinConfig, role, account)
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature };
  }

  /**
   * Transfer master authority to a new account.
   */
  async transferAuthority(
    mintAddress: PublicKey,
    newAuthority: PublicKey
  ): Promise<TransactionResult> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );

    const tx = new Transaction();
    tx.add(
      await this.buildTransferAuthorityInstruction(
        stablecoinConfig,
        newAuthority
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.payer],
      { commitment: "confirmed" }
    );

    return { signature };
  }

  // ─── Read Operations ───────────────────────────────────────

  /**
   * Fetch the stablecoin configuration account.
   */
  async getConfig(mintAddress: PublicKey): Promise<StablecoinConfig | null> {
    const [stablecoinConfig] = findStablecoinConfigPDA(
      mintAddress,
      this.programId
    );

    const info = await this.connection.getAccountInfo(stablecoinConfig);
    if (!info) return null;

    // Decode using Anchor discriminator + borsh
    // In production this would use the IDL; simplified here
    return this.decodeStablecoinConfig(info.data);
  }

  /**
   * Get supply information.
   */
  async getSupply(mintAddress: PublicKey): Promise<SupplyInfo | null> {
    const config = await this.getConfig(mintAddress);
    if (!config) return null;

    const currentSupply = config.totalMinted.sub(config.totalBurned);
    return {
      totalMinted: config.totalMinted,
      totalBurned: config.totalBurned,
      currentSupply,
      decimals: config.decimals,
    };
  }

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

  // ─── Internal Instruction Builders ─────────────────────────

  private async buildInitializeInstruction(
    mint: PublicKey,
    stablecoinConfig: PublicKey,
    args: StablecoinInitArgs
  ): Promise<TransactionInstruction> {
    // Build the instruction data following Anchor's format:
    // 8-byte discriminator + borsh-serialized args
    const discriminator = Buffer.from([
      175, 175, 109, 31, 13, 152, 155, 237, // anchor discriminator for "initialize"
    ]);

    // For a real deployment, use the Anchor-generated IDL client.
    // This is a placeholder that shows the pattern.
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: stablecoinConfig, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: true },
        {
          pubkey: TOKEN_2022_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: discriminator, // Simplified; real impl serializes full args
    });
  }

  private async buildMintInstruction(
    mint: PublicKey,
    stablecoinConfig: PublicKey,
    minterConfig: PublicKey,
    recipientAta: PublicKey,
    amount: BN
  ): Promise<TransactionInstruction> {
    const discriminator = Buffer.from([
      59, 194, 47, 222, 102, 171, 45, 20, // "mint_tokens"
    ]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: stablecoinConfig, isSigner: false, isWritable: true },
        { pubkey: minterConfig, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: recipientAta, isSigner: false, isWritable: true },
        {
          pubkey: TOKEN_2022_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: Buffer.concat([discriminator, amount.toArrayLike(Buffer, "le", 8)]),
    });
  }

  private async buildBurnInstruction(
    mint: PublicKey,
    stablecoinConfig: PublicKey,
    burnerAta: PublicKey,
    amount: BN
  ): Promise<TransactionInstruction> {
    const discriminator = Buffer.from([
      76, 36, 143, 155, 236, 35, 48, 69, // "burn_tokens"
    ]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: stablecoinConfig, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: burnerAta, isSigner: false, isWritable: true },
        {
          pubkey: TOKEN_2022_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: Buffer.concat([discriminator, amount.toArrayLike(Buffer, "le", 8)]),
    });
  }

  private async buildFreezeInstruction(
    mint: PublicKey,
    stablecoinConfig: PublicKey,
    targetAccount: PublicKey,
    freeze: boolean
  ): Promise<TransactionInstruction> {
    // Use the appropriate discriminator based on freeze vs thaw
    const discriminator = freeze
      ? Buffer.from([248, 246, 154, 227, 12, 74, 159, 104]) // "freeze_account"
      : Buffer.from([232, 216, 219, 166, 214, 113, 189, 167]); // "thaw_account"

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: stablecoinConfig, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: targetAccount, isSigner: false, isWritable: true },
        {
          pubkey: TOKEN_2022_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: discriminator,
    });
  }

  private async buildAdminInstruction(
    action: "pause" | "unpause",
    stablecoinConfig: PublicKey
  ): Promise<TransactionInstruction> {
    const discriminator =
      action === "pause"
        ? Buffer.from([211, 22, 221, 251, 74, 121, 193, 47]) // "pause"
        : Buffer.from([105, 81, 155, 247, 59, 207, 64, 121]); // "unpause"

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: stablecoinConfig, isSigner: false, isWritable: true },
      ],
      data: discriminator,
    });
  }

  private async buildUpdateMinterInstruction(
    stablecoinConfig: PublicKey,
    minterConfig: PublicKey,
    minter: PublicKey,
    quota: BN,
    active: boolean
  ): Promise<TransactionInstruction> {
    const discriminator = Buffer.from([
      128, 44, 233, 185, 57, 98, 77, 27, // "update_minter"
    ]);

    const data = Buffer.concat([
      discriminator,
      minter.toBuffer(),
      quota.toArrayLike(Buffer, "le", 8),
      Buffer.from([active ? 1 : 0]),
    ]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: stablecoinConfig, isSigner: false, isWritable: true },
        { pubkey: minterConfig, isSigner: false, isWritable: true },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data,
    });
  }

  private async buildUpdateRolesInstruction(
    stablecoinConfig: PublicKey,
    role: RoleType,
    account: PublicKey
  ): Promise<TransactionInstruction> {
    const discriminator = Buffer.from([
      80, 197, 46, 119, 114, 116, 131, 163, // "update_roles"
    ]);

    const roleIndex =
      role === RoleType.Pauser ? 0 : role === RoleType.Blacklister ? 1 : 2;

    const data = Buffer.concat([
      discriminator,
      Buffer.from([roleIndex]),
      account.toBuffer(),
    ]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: stablecoinConfig, isSigner: false, isWritable: true },
      ],
      data,
    });
  }

  private async buildTransferAuthorityInstruction(
    stablecoinConfig: PublicKey,
    newAuthority: PublicKey
  ): Promise<TransactionInstruction> {
    const discriminator = Buffer.from([
      36, 148, 143, 167, 109, 39, 22, 146, // "transfer_authority"
    ]);

    const data = Buffer.concat([discriminator, newAuthority.toBuffer()]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: stablecoinConfig, isSigner: false, isWritable: true },
      ],
      data,
    });
  }

  // ─── Decoders ──────────────────────────────────────────────

  private decodeStablecoinConfig(data: Buffer): StablecoinConfig {
    // Skip 8-byte discriminator
    let offset = 8;

    const authority = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const mint = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    // Decode borsh strings: 4-byte length prefix + UTF-8 bytes
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const name = data.subarray(offset, offset + nameLen).toString("utf-8");
    offset += nameLen;

    const symbolLen = data.readUInt32LE(offset);
    offset += 4;
    const symbol = data.subarray(offset, offset + symbolLen).toString("utf-8");
    offset += symbolLen;

    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.subarray(offset, offset + uriLen).toString("utf-8");
    offset += uriLen;

    const decimals = data[offset];
    offset += 1;

    const enablePermanentDelegate = data[offset] === 1;
    offset += 1;

    const enableTransferHook = data[offset] === 1;
    offset += 1;

    const defaultAccountFrozen = data[offset] === 1;
    offset += 1;

    const transferHookProgram = new PublicKey(
      data.subarray(offset, offset + 32)
    );
    offset += 32;

    const pauser = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const blacklister = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const seizer = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const paused = data[offset] === 1;
    offset += 1;

    const totalMinted = new BN(data.subarray(offset, offset + 8), "le");
    offset += 8;

    const totalBurned = new BN(data.subarray(offset, offset + 8), "le");
    offset += 8;

    const bump = data[offset];

    return {
      authority,
      mint,
      name,
      symbol,
      uri,
      decimals,
      enablePermanentDelegate,
      enableTransferHook,
      defaultAccountFrozen,
      transferHookProgram,
      pauser,
      blacklister,
      seizer,
      paused,
      totalMinted,
      totalBurned,
      bump,
    };
  }
}
