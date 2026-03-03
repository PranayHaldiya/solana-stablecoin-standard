# Oracle Integration Module

The Oracle module enables non-USD peg stablecoins by integrating price feeds into the Solana Stablecoin Standard. It supports any peg asset (BRL, EUR, BTC, etc.) via Switchboard or compatible price feed aggregators.

---

## Architecture

```
┌─────────────────────────────────┐
│       Client / SDK              │
│  computeMintAmount(collateral)  │
│  computeRedeemAmount(stablecoin)│
├─────────────────────────────────┤
│       sss-oracle Program        │
│  ┌──────────────────────────┐   │
│  │ OracleConfig PDA         │   │
│  │ - mint (linked)          │   │
│  │ - price_feed (address)   │   │
│  │ - peg_asset ("BRL")      │   │
│  │ - max_staleness          │   │
│  └──────────────────────────┘   │
├─────────────────────────────────┤
│   Price Feed Account            │
│   (Switchboard / Pyth / Custom) │
│   - price: i64                  │
│   - timestamp: i64              │
└─────────────────────────────────┘
```

### Design Decisions

1. **No CPI from stablecoin program** — The oracle is a standalone program. It does NOT cross-program invoke into `sss-token`. Instead, it computes amounts via `set_return_data` which clients read.

2. **Generic feed format** — Reads price as `i64` at bytes 8..16 and timestamp as `i64` at bytes 16..24. Compatible with Switchboard aggregator accounts.

3. **Staleness protection** — Rejects prices older than `max_staleness_seconds` to prevent stale price exploitation.

---

## Program Instructions

### `initialize_oracle`

Creates an `OracleConfig` PDA linked to a stablecoin mint.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `authority` | Signer | Oracle admin (usually same as stablecoin authority) |
| `mint` | UncheckedAccount | The stablecoin mint to link |
| `oracle_config` | PDA(init) | `["oracle", mint]` |
| `system_program` | Program | System program |

**Args:**
```rust
OracleInitConfig {
    price_feed: Pubkey,           // Switchboard aggregator address
    peg_asset: String,            // "BRL", "EUR", etc.
    feed_decimals: u8,            // Price precision (e.g., 8 for Switchboard)
    stablecoin_decimals: u8,      // Token decimals (e.g., 6)
    max_staleness_seconds: i64,   // Max age for price feed (e.g., 300)
}
```

### `update_feed`

Updates the price feed address. Authority only.

### `compute_mint_amount`

Given a collateral amount, returns the stablecoin amount to mint.

**Formula:** `stablecoin_amount = collateral_amount × price / 10^feed_decimals`

**Result:** Returned via `set_return_data` as `ComputedAmount`.

### `compute_redeem_amount`

Given a stablecoin amount to burn, returns the collateral to release.

**Formula:** `collateral_amount = stablecoin_amount × 10^feed_decimals / price`

### `read_feed`

Reads the current price from the feed account and caches it in `OracleConfig`.

**Result:** `PriceData { price, decimals, timestamp, peg_asset }` via `set_return_data`.

---

## SDK Usage

### Initialize Oracle

```typescript
import { SolanaStablecoin, findOracleConfigPDA, SSS_ORACLE_PROGRAM_ID } from "@stbr/sss-token";

const [oraclePDA] = findOracleConfigPDA(mintAddress, SSS_ORACLE_PROGRAM_ID);
```

### Compute Mint Amount (Client-Side)

```typescript
import { computeMintAmountFromOracle } from "@stbr/sss-token";
import BN from "bn.js";

// BRL/USD price = 5.50 (scaled: 550 with 2 decimals)
const price = new BN(550);
const feedDecimals = 2;
const collateral = new BN(1_000_000); // 1 USDC (6 decimals)

const brlAmount = computeMintAmountFromOracle(collateral, price, feedDecimals);
// Result: 5_500_000 (5.5 BRL stablecoins)
```

### Compute Redeem Amount (Client-Side)

```typescript
import { computeRedeemAmountFromOracle } from "@stbr/sss-token";

const stablecoinAmount = new BN(5_500_000); // 5.5 BRL tokens
const collateral = computeRedeemAmountFromOracle(stablecoinAmount, price, feedDecimals);
// Result: 1_000_000 (1 USDC)
```

### Fetch Oracle Config

```typescript
import { fetchOracleConfig } from "@stbr/sss-token";

const oracleConfig = await fetchOracleConfig(connection, mintAddress);
if (oracleConfig) {
  console.log(`Peg: ${oracleConfig.pegAsset}`);
  console.log(`Feed: ${oracleConfig.priceFeed.toBase58()}`);
  console.log(`Last Price: ${oracleConfig.lastPrice.toString()}`);
}
```

---

## Switchboard Integration

### Setting Up a Switchboard Feed

1. Create a Switchboard aggregator for your desired pair (e.g., BRL/USD)
2. Note the aggregator account address
3. Pass it as `price_feed` when initializing the oracle

### Feed Data Format

The oracle reads from the price feed account at fixed byte offsets:

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| 0..8 | 8 | — | Discriminator (skipped) |
| 8..16 | 8 | i64 | Price (scaled by feed_decimals) |
| 16..24 | 8 | i64 | Unix timestamp of last update |

This is compatible with Switchboard V2 aggregator result format.

### Example Feed Setup (Devnet)

```bash
# Using Switchboard CLI
sb solana aggregator create \
  --name "BRL/USD" \
  --minOracles 1 \
  --updateInterval 60 \
  --devnet
```

---

## Use Cases

### 1. BRL-Pegged Stablecoin (DREX Pilot)

```
Oracle: BRL/USD @ Switchboard
Mint 1 USD collateral → 5.50 BRL stablecoins
Redeem 5.50 BRL → 1 USD collateral
```

### 2. EUR-Pegged Stablecoin

```
Oracle: EUR/USD @ Pyth/Switchboard
Mint 1 USD collateral → 0.92 EUR stablecoins
Redeem 0.92 EUR → 1 USD collateral
```

### 3. Gold-Backed Token

```
Oracle: XAU/USD @ Switchboard
Mint 2400 USD collateral → 1 XAUT token
Redeem 1 XAUT → 2400 USD collateral
```

---

## Security Considerations

1. **Staleness**: Always set `max_staleness_seconds` to reject stale prices (recommended: 300s)
2. **Feed validation**: The oracle validates the feed account address on every call
3. **Overflow protection**: All arithmetic uses `checked_mul` / `checked_div` with `MathOverflow` errors
4. **Authority**: Only the oracle authority can update the feed address (prevents feed substitution attacks)
5. **No CPI**: The oracle does not invoke mint/burn — the client reads return data and constructs the mint tx separately, maintaining separation of concerns

---

## PDA Derivation

| PDA | Seeds | Purpose |
|-----|-------|---------|
| `OracleConfig` | `["oracle", mint]` | Oracle configuration for a stablecoin |

```typescript
const [oraclePDA, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("oracle"), mintAddress.toBuffer()],
  SSS_ORACLE_PROGRAM_ID
);
```
