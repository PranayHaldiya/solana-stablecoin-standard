# SSS-2: Compliant Stablecoin

## Overview

SSS-2 is the compliant stablecoin preset — designed for regulated tokens that require USDC/USDT-class compliance features. It builds on SSS-1 and adds permanent delegate, transfer hook, and blacklist capabilities.

## When to Use SSS-2

- USDC/USDT-class regulated stablecoins
- CBDC (Central Bank Digital Currency) pilots
- Compliant RWA (Real World Asset) tokens
- Any token subject to sanctions / AML requirements
- Tokens requiring ability to seize/claw back funds

## Token-2022 Extensions

| Extension | Used | Purpose |
|-----------|------|---------|
| Mint Authority | ✅ | PDA-controlled minting |
| Freeze Authority | ✅ | Account-level freezing |
| Metadata | ✅ | On-chain name, symbol, URI |
| Permanent Delegate | ✅ | Token seizure without owner signature |
| Transfer Hook | ✅ | On-chain blacklist enforcement |
| Default Account State | ⚡ | Optional: accounts frozen by default (KYC) |

## Role Model

```
Master Authority
├── All SSS-1 roles plus:
├── Blacklister — add/remove addresses from on-chain blacklist
└── Seizer — seize tokens from blacklisted accounts via permanent delegate
```

## How Transfer Hook Works

When `enable_transfer_hook = true`, every token transfer triggers the `sss-transfer-hook` program:

```
1. User calls transfer_checked on Token-2022
2. Token-2022 invokes sss-transfer-hook
3. Transfer hook resolves ExtraAccountMetas:
   - Sender's blacklist PDA: ["blacklist", config, sender]
   - Recipient's blacklist PDA: ["blacklist", config, recipient]
4. Hook checks if either PDA account exists
5. If blacklisted → transfer REJECTED (error)
6. If clean → transfer proceeds normally
```

### Key Properties

- **Atomic**: Hook runs within the same transaction as the transfer
- **Can't be bypassed**: Token-2022 enforces the hook on ALL transfers
- **Fail-safe**: If the hook program is unavailable, transfers fail (safe default)
- **No gas overhead for clean transfers**: Blacklist PDAs don't exist for clean users, so the accounts are passed as empty

## How Permanent Delegate Works

The `PermanentDelegate` extension designates the StablecoinConfig PDA as a permanent delegate for ALL token accounts of this mint. This means:

- The program can call `transfer_checked` on behalf of any token holder
- Used exclusively for compliance seizure — moving tokens from a blacklisted account to a treasury
- Cannot be revoked by the token holder (this is by design for regulated tokens)

## Lifecycle

### 1. Initialize with Compliance Extensions

```typescript
const result = await sdk.create({
  ...Presets.SSS_2.defaults,
  name: "Compliant USD",
  symbol: "CUSD",
  uri: "https://example.com/metadata.json",
});

// Automatically creates mint with:
// - PermanentDelegate extension (delegate = PDA)
// - TransferHook extension (hook program = sss-transfer-hook)
```

### 2. Setup Transfer Hook Extra Account Metas

After initialization, the transfer hook's `ExtraAccountMetaList` is initialized. This tells Token-2022 which additional accounts to pass to the hook on every transfer.

### 3. Compliance Operations

```typescript
const compliance = new ComplianceModule({ connection, wallet });

// Blacklist an address
await compliance.addToBlacklist(
  mintAddress,
  sanctionedAddress,
  "OFAC SDN List match"
);

// Check blacklist status
const isBlocked = await compliance.isBlacklisted(mintAddress, someAddress);

// Seize tokens from blacklisted account
await compliance.seize(
  mintAddress,
  sanctionedOwner,
  treasuryTokenAccount,
  new BN(1_000_000) // amount to seize
);

// Remove from blacklist (after review)
await compliance.removeFromBlacklist(mintAddress, address);
```

### 4. Default Frozen Accounts (Optional KYC)

When `defaultAccountFrozen = true`:
- All new token accounts start in a frozen state
- Users must be approved (thawed) before they can receive tokens
- Effectively implements a KYC-gated token

```typescript
const result = await sdk.create({
  ...Presets.SSS_2.defaults,
  defaultAccountFrozen: true, // Enable KYC gating
  name: "KYC USD",
  symbol: "KYUSD",
  uri: "...",
});

// Approve a user (thaw their account)
await sdk.thaw(mintAddress, userTokenAccount);
```

## Compliance Flow

```
1. DETECT — Off-chain compliance service detects sanctioned address
2. BLACKLIST — Blacklister calls addToBlacklist on-chain
3. BLOCK — Transfer hook automatically blocks all transfers
4. FREEZE — Authority freezes the token account
5. SEIZE — Seizer moves tokens to treasury via permanent delegate
6. REPORT — Compliance service generates audit report
```

## Comparison: SSS-1 vs SSS-2

| Feature | SSS-1 | SSS-2 |
|---------|-------|-------|
| Mint/Burn | ✅ | ✅ |
| Freeze/Thaw | ✅ | ✅ |
| Pause | ✅ | ✅ |
| Role Management | ✅ | ✅ |
| Transfer Blocking | ❌ | ✅ (hook) |
| Token Seizure | ❌ | ✅ (delegate) |
| Blacklist | ❌ | ✅ |
| KYC Gating | ❌ | ✅ (optional) |
| Gas Cost (transfer) | Lower | Slightly higher (hook CPI) |
