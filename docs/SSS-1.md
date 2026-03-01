# SSS-1: Minimal Stablecoin

## Overview

SSS-1 is the minimal stablecoin preset — the simplest viable configuration for a production stablecoin on Solana. It uses Token-2022's mint authority, freeze authority, and metadata extensions.

## When to Use SSS-1

- Simple stablecoins backed by fiat or crypto reserves
- DAO treasury tokens
- Wrapped assets (e.g., wrapped EURC)
- Internal tokens for gaming / DeFi protocols
- Any token that needs controlled minting but not full compliance

## Token-2022 Extensions

| Extension | Used | Purpose |
|-----------|------|---------|
| Mint Authority | ✅ | PDA-controlled minting |
| Freeze Authority | ✅ | Account-level freezing |
| Metadata | ✅ | On-chain name, symbol, URI |
| Permanent Delegate | ❌ | Not needed for SSS-1 |
| Transfer Hook | ❌ | Not needed for SSS-1 |

## Role Model

```
Master Authority (single key or multisig)
├── Manages all role assignments
├── Can transfer authority to new key
└── Assigns:
    ├── Minter(s) — each with independent quota
    └── Pauser — can pause/unpause all operations
```

## Lifecycle

### 1. Initialization

```typescript
const result = await sdk.create({
  ...Presets.SSS_1.defaults,
  name: "My USD Stablecoin",
  symbol: "MUSD",
  uri: "https://example.com/token-metadata.json",
});
```

This:
1. Creates a Token-2022 mint (no extra extensions)
2. Sets PDA as mint authority and freeze authority
3. Creates `StablecoinConfig` PDA with role assignments
4. Sets `enable_permanent_delegate = false`, `enable_transfer_hook = false`

### 2. Add Minters

```typescript
await sdk.updateMinter(
  mintAddress,
  minterPubkey,
  new BN(1_000_000_000_000), // 1M token quota
  true
);
```

### 3. Mint Tokens

```typescript
await sdk.mint(mintAddress, recipientPubkey, new BN(100_000_000));
```

Enforces:
- Caller must be an active minter
- Amount must not exceed remaining quota
- Stablecoin must not be paused

### 4. Burn Tokens

```typescript
await sdk.burn(mintAddress, new BN(50_000_000));
```

Burns tokens from the caller's own account.

### 5. Freeze / Thaw

```typescript
await sdk.freeze(mintAddress, targetTokenAccount);
await sdk.thaw(mintAddress, targetTokenAccount);
```

### 6. Pause / Unpause

```typescript
await sdk.pause(mintAddress);   // All minting paused
await sdk.unpause(mintAddress); // Resumed
```

## Limitations

- No blacklist enforcement (transfers cannot be blocked)
- No token seizure capability
- No transfer-level restrictions
- Individual account freezing is available, but not enforced at the transfer level

For compliance features, use [SSS-2](SSS-2.md).
