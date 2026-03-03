# SDK Reference

## Installation

```bash
npm install @stbr/sss-token
```

## Quick Start

```typescript
import {
  SolanaStablecoin,
  Presets,
  ComplianceModule,
} from "@stbr/sss-token";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const wallet = new Wallet(keypair);

const sdk = new SolanaStablecoin({ connection, wallet });
```

## SolanaStablecoin

Main class for interacting with SSS programs.

### Constructor

```typescript
new SolanaStablecoin({
  connection: Connection,     // Solana RPC connection
  wallet: Wallet,             // Signer wallet
  programId?: PublicKey,      // SSS token program ID (optional)
  transferHookProgramId?: PublicKey, // Hook program ID (optional)
})
```

### Methods

#### `create(args: StablecoinInitArgs): Promise<InitResult>`

Create a new stablecoin with Token-2022 extensions.

```typescript
const result = await sdk.create({
  name: "My USD",
  symbol: "MUSD",
  uri: "https://example.com/metadata.json",
  decimals: 6,
  enablePermanentDelegate: false,
  enableTransferHook: false,
  defaultAccountFrozen: false,
});

// result.mint - PublicKey of the new token mint
// result.stablecoinConfig - PDA address
// result.preset - "SSS-1" or "SSS-2"
// result.signature - Transaction signature
```

**Using presets:**

```typescript
// SSS-1 Minimal
const sss1 = await sdk.create({
  ...Presets.SSS_1.defaults,
  name: "My USD",
  symbol: "MUSD",
  uri: "https://example.com/metadata.json",
});

// SSS-2 Compliant
const sss2 = await sdk.create({
  ...Presets.SSS_2.defaults,
  name: "Compliant USD",
  symbol: "CUSD",
  uri: "https://example.com/metadata.json",
});
```

#### `mint(mint, recipient, amount): Promise<MintResult>`

Mint tokens to a recipient. Caller must be an authorized minter.

```typescript
import { BN } from "bn.js";

const result = await sdk.mint(
  mintAddress,
  recipientAddress,
  new BN(1_000_000) // 1 token (6 decimals)
);
```

#### `burn(mint, amount): Promise<BurnResult>`

Burn tokens from the caller's account.

```typescript
const result = await sdk.burn(mintAddress, new BN(500_000));
```

#### `freeze(mint, targetAccount): Promise<TransactionResult>`

Freeze a token account.

```typescript
await sdk.freeze(mintAddress, targetTokenAccount);
```

#### `thaw(mint, targetAccount): Promise<TransactionResult>`

Thaw a frozen token account.

```typescript
await sdk.thaw(mintAddress, targetTokenAccount);
```

#### `pause(mint): Promise<TransactionResult>`

Pause all token operations. Requires pauser role.

```typescript
await sdk.pause(mintAddress);
```

#### `unpause(mint): Promise<TransactionResult>`

Resume operations.

```typescript
await sdk.unpause(mintAddress);
```

#### `updateMinter(mint, minter, quota, active): Promise<TransactionResult>`

Add or update a minter's quota.

```typescript
await sdk.updateMinter(
  mintAddress,
  minterPubkey,
  new BN(10_000_000_000), // 10,000 token quota
  true // active
);
```

#### `updateRole(mint, role, account): Promise<TransactionResult>`

Update a role assignment.

```typescript
import { RoleType } from "@stbr/sss-token";

await sdk.updateRole(mintAddress, RoleType.Pauser, newPauserPubkey);
await sdk.updateRole(mintAddress, RoleType.Blacklister, newBlacklisterPubkey);
await sdk.updateRole(mintAddress, RoleType.Seizer, newSeizerPubkey);
```

#### `transferAuthority(mint, newAuthority): Promise<TransactionResult>`

Transfer master authority.

```typescript
await sdk.transferAuthority(mintAddress, newAuthorityPubkey);
```

#### `getConfig(mint): Promise<StablecoinConfig | null>`

Fetch stablecoin configuration from on-chain.

```typescript
const config = await sdk.getConfig(mintAddress);
if (config) {
  console.log("Name:", config.name);
  console.log("Paused:", config.paused);
  console.log("SSS-2:", config.enablePermanentDelegate);
}
```

#### `getSupply(mint): Promise<SupplyInfo | null>`

Get supply information.

```typescript
const supply = await sdk.getSupply(mintAddress);
console.log("Current supply:", supply.currentSupply.toString());
```

#### `isBlacklisted(mint, address): Promise<boolean>`

Check if an address is blacklisted.

```typescript
const blacklisted = await sdk.isBlacklisted(mintAddress, suspectAddress);
```

## ComplianceModule

SSS-2 compliance operations.

### Constructor

```typescript
const compliance = new ComplianceModule({
  connection,
  wallet,
  programId?: PublicKey,
});
```

### Methods

#### `addToBlacklist(mint, address, reason): Promise<TransactionResult>`

```typescript
await compliance.addToBlacklist(
  mintAddress,
  badActorAddress,
  "Sanctions compliance"
);
```

#### `removeFromBlacklist(mint, address): Promise<TransactionResult>`

```typescript
await compliance.removeFromBlacklist(mintAddress, address);
```

#### `seize(mint, fromOwner, treasuryAta, amount): Promise<SeizeResult>`

```typescript
const result = await compliance.seize(
  mintAddress,
  badActorAddress,
  treasuryTokenAccount,
  new BN(1_000_000)
);
```

#### `getBlacklistEntry(mint, address): Promise<BlacklistEntry | null>`

```typescript
const entry = await compliance.getBlacklistEntry(mintAddress, address);
if (entry) {
  console.log("Reason:", entry.reason);
  console.log("Added by:", entry.blacklistedBy.toBase58());
}
```

## Presets

```typescript
import { Presets } from "@stbr/sss-token";

// Access presets
Presets.SSS_1  // Minimal stablecoin config
Presets.SSS_2  // Compliant stablecoin config

// Get by name
Presets.get("SSS-1")
Presets.get("SSS-2")

// List all
Presets.list()  // [SSS_1, SSS_2]
```

## PDA Helpers

```typescript
import {
  findStablecoinConfigPDA,
  findMinterConfigPDA,
  findBlacklistEntryPDA,
  findExtraAccountMetaListPDA,
} from "@stbr/sss-token";

const [configPDA, bump] = findStablecoinConfigPDA(mintPubkey);
const [minterPDA] = findMinterConfigPDA(configPDA, minterPubkey);
const [blacklistPDA] = findBlacklistEntryPDA(configPDA, addressPubkey);
const [metaPDA] = findExtraAccountMetaListPDA(mintPubkey);
```

## Types

```typescript
interface StablecoinConfig {
  authority: PublicKey;
  mint: PublicKey;
  name: string;
  symbol: string;
  // ... see types.ts for full interface
}

interface InitResult {
  signature: string;
  mint: PublicKey;
  stablecoinConfig: PublicKey;
  preset: "SSS-1" | "SSS-2";
}

interface MintResult {
  signature: string;
  amount: BN;
  recipient: PublicKey;
}

enum RoleType {
  Pauser = "Pauser",
  Blacklister = "Blacklister",
  Seizer = "Seizer",
}
```
