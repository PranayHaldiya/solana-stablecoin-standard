# Deployment Guide & Evidence

## Devnet Deployment

All three on-chain programs are deployed and verified on **Solana Devnet**.

### Program IDs

| Program | Program ID | Explorer Link |
|---------|-----------|---------------|
| **sss-token** (Core Stablecoin) | `3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk` | [View on Solana Explorer](https://explorer.solana.com/address/3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk?cluster=devnet) |
| **sss-transfer-hook** (Compliance Hook) | `J8sRn7M35NfUi511JY3Hnw4dPBm9UvwmpKCBrAbzCMKq` | [View on Solana Explorer](https://explorer.solana.com/address/J8sRn7M35NfUi511JY3Hnw4dPBm9UvwmpKCBrAbzCMKq?cluster=devnet) |
| **sss-oracle** (Price Feed Reader) | `E7U8UzJKqKaRBNVyeJ44kzBsuEf11TbjPETGeewzznLs` | [View on Solana Explorer](https://explorer.solana.com/address/E7U8UzJKqKaRBNVyeJ44kzBsuEf11TbjPETGeewzznLs?cluster=devnet) |

### Deployment Transactions

| Program | Transaction Signature | Explorer Link |
|---------|----------------------|---------------|
| sss-token | `EPBXQBD7HwBzicEQLHzskgsjgeKrHMGmLkzpquJLYf5SpC998Pi9fKZuE3g7hWC6dWfSQJMsgLyFw4pN6g83mm4` | [View Transaction](https://explorer.solana.com/tx/EPBXQBD7HwBzicEQLHzskgsjgeKrHMGmLkzpquJLYf5SpC998Pi9fKZuE3g7hWC6dWfSQJMsgLyFw4pN6g83mm4?cluster=devnet) |
| sss-transfer-hook | `2TZFJQqde2nsS5ScLSgsvmWbkxjhpXLQ3sLiwfsxS4rdxEo3qMfJLxeqgKnRgSZ1JBCUHsf6ETbwi4H5djqWWC3q` | [View Transaction](https://explorer.solana.com/tx/2TZFJQqde2nsS5ScLSgsvmWbkxjhpXLQ3sLiwfsxS4rdxEo3qMfJLxeqgKnRgSZ1JBCUHsf6ETbwi4H5djqWWC3q?cluster=devnet) |
| sss-oracle | `mwfRsXkPtESeK9AYoB3GcsGKEya53K85uqg4joC7DL6gn1nN2m9qGsEEpnRUb6wA2uho2mpHJX925ghLS3GM159` | [View Transaction](https://explorer.solana.com/tx/mwfRsXkPtESeK9AYoB3GcsGKEya53K85uqg4joC7DL6gn1nN2m9qGsEEpnRUb6wA2uho2mpHJX925ghLS3GM159?cluster=devnet) |

### Deploy Authority

- **Deployer Wallet**: `7M4DtmofjMtE1qt47TYyq5k9WBZ5Hf7XrXQBfvADyFdQ`

---

## How to Reproduce Deployment

### Prerequisites

```bash
# Solana CLI 1.18+ / 2.1+
solana --version

# Anchor 0.30.1
anchor --version

# Rust with Solana BPF toolchain
cargo build-sbf --version
```

### Step 1: Configure Solana for Devnet

```bash
solana config set --url devnet
solana-keygen new -o deploy-keypair.json  # or use existing
solana airdrop 5 deploy-keypair.json
```

### Step 2: Build Programs

```bash
# Build both on-chain programs
cargo build-sbf --manifest-path programs/sss-token/Cargo.toml
cargo build-sbf --manifest-path programs/sss-transfer-hook/Cargo.toml
```

**Expected outputs:**
```
target/deploy/sss_token.so
target/deploy/sss_transfer_hook.so
```

### Step 3: Deploy to Devnet

```bash
# Deploy core stablecoin program
solana program deploy \
  target/deploy/sss_token.so \
  --keypair deploy-keypair.json \
  --program-id programs/sss-token/keypair.json

# Deploy transfer hook program
solana program deploy \
  target/deploy/sss_transfer_hook.so \
  --keypair deploy-keypair.json \
  --program-id programs/sss-transfer-hook/keypair.json
```

### Step 4: Verify Deployment

```bash
# Check program is deployed
solana program show 3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk --url devnet
solana program show J8sRn7M35NfUi511JY3Hnw4dPBm9UvwmpKCBrAbzCMKq --url devnet
```

---

## SSS-1 Lifecycle (Devnet Example)

```bash
# 1. Initialize SSS-1 stablecoin
sss init --preset sss-1 --name "Demo USD" --symbol DUSD --uri "https://example.com/meta.json" --decimals 6

# 2. Add a minter with quota
sss minter add <MINTER_PUBKEY> --quota 1000000000 --mint <MINT_ADDRESS>

# 3. Mint tokens
sss mint <RECIPIENT> 1000000 --mint <MINT_ADDRESS>

# 4. Check supply
sss supply --mint <MINT_ADDRESS>

# 5. Freeze an account
sss freeze <ACCOUNT> --mint <MINT_ADDRESS>

# 6. Thaw the account
sss thaw <ACCOUNT> --mint <MINT_ADDRESS>

# 7. Burn tokens
sss burn 500000 --mint <MINT_ADDRESS>

# 8. Pause all operations
sss pause --mint <MINT_ADDRESS>

# 9. Unpause
sss unpause --mint <MINT_ADDRESS>
```

## SSS-2 Lifecycle (Devnet Example)

```bash
# 1. Initialize SSS-2 compliant stablecoin (includes transfer hook + permanent delegate)
sss init --preset sss-2 --name "Regulated USD" --symbol RUSD --uri "https://example.com/meta.json" --decimals 6

# 2. Add minter
sss minter add <MINTER_PUBKEY> --quota 5000000000 --mint <MINT_ADDRESS>

# 3. Mint tokens
sss mint <RECIPIENT> 2000000 --mint <MINT_ADDRESS>

# 4. Add address to blacklist (compliance action)
sss blacklist add <SANCTIONED_ADDRESS> --reason "OFAC sanctions" --mint <MINT_ADDRESS>

# 5. Seize tokens from blacklisted account (permanent delegate action)
sss seize <SANCTIONED_ADDRESS> --mint <MINT_ADDRESS>

# 6. Remove from blacklist after resolution
sss blacklist remove <ADDRESS> --mint <MINT_ADDRESS>
```

---

## Localnet Testing

```bash
# Start local validator
solana-test-validator --reset

# Deploy locally
anchor deploy --provider.cluster localnet

# Run integration tests
anchor test
```

---

## Environment Requirements

| Component | Minimum Version | Recommended |
|-----------|----------------|-------------|
| Solana CLI | 1.18.0 | 2.1.14 |
| Anchor | 0.30.0 | 0.30.1 |
| Rust | 1.75.0 | 1.79.0+ |
| Node.js | 18.0 | 20.0+ |
| Docker | 20.0 | 24.0+ (for backend services) |

## Deployment Cost Estimates

| Action | Approximate SOL Cost |
|--------|---------------------|
| Deploy sss-token | ~2.5 SOL |
| Deploy sss-transfer-hook | ~1.5 SOL |
| Initialize stablecoin | ~0.01 SOL |
| Mint tokens | ~0.005 SOL |
| Add to blacklist | ~0.005 SOL |

> **Note**: Costs are approximate and depend on program size and rent-exempt requirements. Devnet SOL is free via `solana airdrop`.
