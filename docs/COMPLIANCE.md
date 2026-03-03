# Compliance Guide

## Overview

This guide covers compliance features available in SSS-2 stablecoins — blacklist management, transfer hook enforcement, and token seizure via permanent delegate.

## Blacklist Management

### On-Chain Blacklist

SSS-2 maintains an on-chain blacklist using PDA accounts:

```
BlacklistEntry PDA: ["blacklist", stablecoin_config, address]
```

Each entry stores:
- The blacklisted address
- Reason for blacklisting
- Timestamp
- Who added the entry

### Adding to Blacklist

**Using SDK:**
```typescript
await compliance.addToBlacklist(
  mintAddress,
  targetAddress,
  "OFAC SDN List - SDN-12345"
);
```

**Using CLI:**
```bash
sss blacklist-add \
  --mint <MINT_ADDRESS> \
  --address <TARGET_ADDRESS> \
  --reason "OFAC SDN List match"
```

**Using Service API:**
```bash
curl -X POST http://localhost:3003/blacklist/add \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "<MINT_ADDRESS>",
    "address": "<TARGET_ADDRESS>",
    "reason": "Sanctions compliance"
  }'
```

### Removing from Blacklist

```typescript
await compliance.removeFromBlacklist(mintAddress, targetAddress);
```

### Checking Blacklist Status

```typescript
const blacklisted = await compliance.isBlacklisted(mintAddress, address);

const entry = await compliance.getBlacklistEntry(mintAddress, address);
if (entry) {
  console.log("Reason:", entry.reason);
  console.log("Added:", new Date(entry.createdAt.toNumber() * 1000));
}
```

## Transfer Hook Enforcement

When a transfer is initiated for an SSS-2 token:

1. Token-2022 automatically invokes the `sss-transfer-hook` program
2. The hook checks both sender and recipient against the blacklist
3. If either party is blacklisted, the transfer is **rejected atomically**
4. No off-chain intervention required

### Key Properties

- **Cannot be bypassed**: Token-2022 enforces the hook
- **Atomic**: Runs within the transfer transaction
- **Bidirectional**: Checks both sender AND recipient
- **Zero overhead for clean users**: Blacklist PDAs don't exist for non-blacklisted users

## Token Seizure

For cases where tokens must be recovered from a blacklisted/sanctioned account:

```typescript
const result = await compliance.seize(
  mintAddress,
  badActorAddress,        // Owner of tokens to seize
  treasuryTokenAccount,   // Where seized tokens go
  new BN(1_000_000)       // Amount to seize
);
```

### How It Works

1. The `seize` instruction uses Token-2022's **Permanent Delegate** extension
2. The StablecoinConfig PDA is the permanent delegate for all token accounts
3. The program calls `transfer_checked` with the PDA as delegate authority
4. No signature from the token owner is required

### When to Use Seizure

- Court orders requiring asset freeze and recovery
- Sanctions compliance (OFAC, EU sanctions)
- Recovery of stolen funds (with proper legal basis)
- Regulatory compliance actions

## Compliance Workflow

### Recommended Process

```
1. MONITOR
   └── Off-chain compliance service monitors watchlists
       (OFAC SDN, EU, UK HMT, UN)

2. DETECT
   └── Match found → create compliance case

3. BLACKLIST
   └── Blacklister adds address to on-chain blacklist
   └── Transfer hook immediately blocks transfers

4. FREEZE
   └── Authority freezes the token account
   └── Prevents any remaining operations

5. ASSESS
   └── Compliance team reviews the case
   └── Document evidence and legal basis

6. SEIZE (if required)
   └── Seizer transfers tokens to treasury
   └── Log the seizure with full audit trail

7. REPORT
   └── Generate compliance report
   └── File SARs if required
```

### Audit Trail

All compliance actions emit on-chain events:

| Event | Fields |
|-------|--------|
| `BlacklistAdded` | mint, address, reason, blacklister, timestamp |
| `BlacklistRemoved` | mint, address, blacklister, timestamp |
| `TokensSeized` | mint, from, to, amount, seizer, timestamp |

These events are captured by the Indexer service and can be queried via the API.

## API Endpoints

### Compliance Service (port 3003)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/check/:mint/:address` | Check if address is blacklisted |
| POST | `/blacklist/add` | Add address to blacklist |
| POST | `/blacklist/remove` | Remove from blacklist |
| GET | `/blacklist/:mint` | Get full blacklist for a mint |
| GET | `/report/:mint` | Generate compliance report |

## Regulatory Considerations

- All blacklist actions should be documented with legal basis
- Seizure should only be performed with proper authorization
- Keep records of all compliance actions for regulatory audits
- Consider implementing multi-sig for critical compliance actions
- The on-chain blacklist provides an immutable audit trail
