# Security Model

This document describes the access control model, threat mitigations, and security design decisions in the Solana Stablecoin Standard.

---

## Access Control Model

### Role Hierarchy

```
┌─────────────────────────────────────┐
│          Master Authority           │
│  (Can assign all roles, transfer    │
│   authority, upgrade programs)      │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐  ┌──────────────────┐ │
│  │  Minter  │  │  Pauser          │ │
│  │  (quota) │  │  (pause/unpause) │ │
│  └──────────┘  └──────────────────┘ │
│                                     │
│  ┌──────────────┐  ┌─────────────┐  │
│  │ Blacklister  │  │  Seizer     │  │
│  │ (SSS-2 only) │  │ (SSS-2 only)│  │
│  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────┘
```

### Role Definitions

| Role | Permissions | Preset |
|------|------------|--------|
| **Master Authority** | Assign/revoke all roles, transfer authority, initialize stablecoin | SSS-1, SSS-2 |
| **Minter** | Mint tokens up to assigned quota, burn own tokens | SSS-1, SSS-2 |
| **Pauser** | Pause/unpause all token operations globally | SSS-1, SSS-2 |
| **Blacklister** | Add/remove addresses from blacklist | SSS-2 only |
| **Seizer** | Seize tokens from blacklisted accounts via permanent delegate | SSS-2 only |

### Authority Checks

Every instruction validates the caller against the appropriate role:

```rust
// Example: Only master authority can assign roles
require!(
    ctx.accounts.authority.key() == config.authority,
    StablecoinError::Unauthorized
);

// Example: Only active minters with sufficient quota can mint
require!(minter_config.active, StablecoinError::Unauthorized);
require!(
    minter_config.minted + amount <= minter_config.quota,
    StablecoinError::QuotaExceeded
);
```

---

## PDA Security

All critical state is stored in Program Derived Addresses (PDAs), which ensures:

1. **No private key exists** — PDAs cannot sign transactions externally
2. **Deterministic derivation** — Anyone can verify PDA addresses from seeds
3. **Program-controlled access** — Only the owning program can modify PDA data

### PDA Seeds

| PDA | Seeds | Purpose |
|-----|-------|---------|
| `StablecoinConfig` | `["stablecoin", mint]` | Core configuration for each stablecoin |
| `MinterConfig` | `["minter", stablecoin, minter_pubkey]` | Per-minter quota tracking |
| `BlacklistEntry` | `["blacklist", stablecoin, address]` | On-chain blacklist record |
| `ExtraAccountMetaList` | `["extra-account-metas", mint]` | Transfer hook extra accounts |

---

## Error Handling

All operations return specific error codes to prevent ambiguous failures:

| Error Code | Error Name | Description |
|-----------|------------|-------------|
| 6000 | `ZeroAmount` | Mint/burn amount must be > 0 |
| 6001 | `Paused` | Operations blocked during global pause |
| 6002 | `NotPaused` | Cannot unpause when not paused |
| 6003 | `Unauthorized` | Caller lacks required role |
| 6004 | `QuotaExceeded` | Minter exceeded their minting quota |
| 6005 | `Blacklisted` | Target address is on the blacklist |
| 6006 | `NotBlacklisted` | Cannot remove non-blacklisted address |
| 6007 | `ComplianceNotEnabled` | SSS-2 feature used on SSS-1 mint |
| 6008 | `TransferHookNotEnabled` | Transfer hook feature on SSS-1 mint |
| 6009 | `PermanentDelegateNotEnabled` | Permanent delegate on SSS-1 mint |
| 6010 | `InvalidConfig` | Invalid initialization parameters |
| 6011 | `NameTooLong` | Name exceeds 32 characters |
| 6012 | `SymbolTooLong` | Symbol exceeds 10 characters |
| 6013 | `UriTooLong` | URI exceeds 200 characters |
| 6014 | `ReasonTooLong` | Blacklist reason exceeds 128 characters |
| 6015 | `InvalidDecimals` | Decimals > 9 |
| 6016 | `MinterInactive` | Minter has been deactivated |
| 6017 | `MathOverflow` | Arithmetic overflow during supply tracking |

---

## Threat Model & Mitigations

### 1. Unauthorized Minting

**Threat**: Attacker mints tokens without authority.

**Mitigations**:
- Mint authority is a PDA controlled by the program, not an external keypair
- Per-minter quotas enforce upper bounds (`MinterConfig.quota`)
- Only the master authority can add new minters (`update_minter`)
- Minters must be marked active (`minter_config.active == true`)

### 2. Unauthorized Token Seizure

**Threat**: Attacker seizes tokens from arbitrary accounts.

**Mitigations**:
- Seize requires `seizer` role assigned by master authority
- Target must have an active `BlacklistEntry` PDA
- Only available on SSS-2 mints with permanent delegate enabled
- Seize amount is bounded by the target's actual balance

### 3. Blacklist Bypass via Transfer

**Threat**: Blacklisted address transfers tokens before seizure.

**Mitigations**:
- SSS-2 deploys a transfer hook that checks **both** sender and recipient against blacklist PDAs on every transfer
- The transfer hook runs atomically within every `Transfer` instruction via Token-2022's transfer hook extension
- Blacklisted addresses cannot send or receive tokens

### 4. Supply Manipulation

**Threat**: Attacker inflates supply via overflow.

**Mitigations**:
- `total_minted` and `total_burned` use `checked_add` / `checked_sub` with `MathOverflow` error
- Burn amount bounded by owner's actual token balance (Token-2022 enforced)
- Mint amount bounded by minter quota

### 5. Re-initialization Attack

**Threat**: Attacker re-initializes an existing stablecoin to reset authority.

**Mitigations**:
- `StablecoinConfig` PDA uses `init` constraint (Anchor), which fails if account already exists
- PDA derivation includes the mint address, ensuring 1:1 mapping

### 6. Global Pause Bypass

**Threat**: Operations continue during emergency pause.

**Mitigations**:
- All mutable instructions check `require!(!config.paused, StablecoinError::Paused)`
- Pause/unpause restricted to `pauser` role only
- View-only queries (supply, blacklist check) remain available during pause

### 7. Frontrunning / MEV

**Threat**: Attacker frontrunning authorize/blacklist transactions.

**Mitigations**:
- PDA-based authority means operations are programmatic, not custodial key-dependent
- On-chain checks are atomic within a single transaction
- Blacklist enforcement is transfer hook-based (cannot be bypassed by ordering)

---

## Token-2022 Extension Security

### Permanent Delegate (SSS-2)

- Enables token seizure without owner signature
- Set at mint creation time, **cannot be added later**
- Only the program PDA holds delegate authority
- Delegate cannot transfer to arbitrary accounts — seize goes to treasury/burn

### Transfer Hook (SSS-2)

- Runs on **every** token transfer, including CPI transfers
- Cannot be bypassed — enforced by Token-2022 runtime
- Extra account meta list includes sender and recipient blacklist PDAs
- Hook verifies the transfer is coming from Token-2022 program (anti-spoof)

### Freeze Authority

- Allows freezing individual token accounts
- Frozen accounts cannot send or receive tokens
- Useful for investigation periods before blacklisting

---

## Audit Considerations

### What Auditors Should Review

1. **Authority transfer atomicity** — `transfer_authority` updates all fields in one tx
2. **Quota enforcement correctness** — `minted + amount <= quota` check
3. **Transfer hook account validation** — extra account meta ordering matches runtime expectations
4. **PDA derivation uniqueness** — each PDA seed combination produces a unique address
5. **Blacklist race conditions** — blacklist creation vs. transfer hook check ordering

### Known Limitations

1. **No multisig support** — Master authority is a single Pubkey (can be a multisig program)
2. **No timelock** — Role changes take effect immediately
3. **No upgrade authority separation** — Program upgrade authority is separate from stablecoin authority
4. **Supply tracking is eventually consistent** — `total_minted`/`total_burned` are convenience counters, actual supply should be verified via `token.supply`

---

## Responsible Disclosure

If you discover a security vulnerability, please report it responsibly:

1. Do NOT open a public GitHub issue
2. Contact the maintainers via the repository's security advisory feature
3. Allow 72 hours for initial response
