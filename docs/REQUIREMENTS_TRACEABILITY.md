# Requirements Traceability Matrix

Maps each bounty requirement to its implementation location. This document ensures 100% coverage of the Solana Stablecoin Standard specification.

---

## Legend

| Status | Meaning |
|--------|---------|
| **Done** | Implemented and tested |
| **Partial** | Core implemented, edge cases may need hardening |

---

## BR-01: On-Chain Token Program (SSS-1 Minimal)

**Status: Done**

| Feature | Implementation | Test |
|---------|---------------|------|
| Initialize Token-2022 mint | [programs/sss-token/src/instructions/initialize.rs](../programs/sss-token/src/instructions/initialize.rs) | `sss-1.test.ts` → "should create a Token-2022 mint" |
| Config PDA creation | [programs/sss-token/src/state.rs](../programs/sss-token/src/state.rs) `StablecoinConfig` | `sss-1.test.ts` → "should initialize SSS-1 stablecoin config" |
| Mint with quota enforcement | [programs/sss-token/src/instructions/mint.rs](../programs/sss-token/src/instructions/mint.rs) | `sss-1.test.ts` → "should mint tokens to recipient" |
| Burn from caller | [programs/sss-token/src/instructions/burn.rs](../programs/sss-token/src/instructions/burn.rs) | `sss-1.test.ts` → "should burn tokens from caller account" |
| Freeze / thaw accounts | [programs/sss-token/src/instructions/freeze.rs](../programs/sss-token/src/instructions/freeze.rs) | `sss-1.test.ts` → "should freeze/thaw a token account" |
| Global pause / unpause | [programs/sss-token/src/instructions/admin.rs](../programs/sss-token/src/instructions/admin.rs) | `sss-1.test.ts` → "should pause/unpause operations" |
| Transfer authority | [programs/sss-token/src/instructions/admin.rs](../programs/sss-token/src/instructions/admin.rs) | `sss-1.test.ts` → "should transfer master authority" |
| Per-minter quotas | [programs/sss-token/src/instructions/roles.rs](../programs/sss-token/src/instructions/roles.rs) | `sss-1.test.ts` → "should add a minter with quota" |
| Role management | [programs/sss-token/src/instructions/roles.rs](../programs/sss-token/src/instructions/roles.rs) | `sss-2.test.ts` → "should update blacklister/seizer role" |

---

## BR-02: On-Chain Compliance Program (SSS-2 Compliant)

**Status: Done**

| Feature | Implementation | Test |
|---------|---------------|------|
| Permanent delegate extension | [programs/sss-token/src/instructions/initialize.rs](../programs/sss-token/src/instructions/initialize.rs) | `sss-2.test.ts` → "should create mint with permanent delegate + transfer hook" |
| Transfer hook extension | [programs/sss-transfer-hook/src/lib.rs](../programs/sss-transfer-hook/src/lib.rs) | `sss-2.test.ts` → "should block transfers from blacklisted sender" |
| Add to blacklist | [programs/sss-token/src/instructions/compliance.rs](../programs/sss-token/src/instructions/compliance.rs) | `sss-2.test.ts` → "should add address to blacklist" |
| Remove from blacklist | [programs/sss-token/src/instructions/compliance.rs](../programs/sss-token/src/instructions/compliance.rs) | `sss-2.test.ts` → "should remove address from blacklist" |
| Token seizure | [programs/sss-token/src/instructions/compliance.rs](../programs/sss-token/src/instructions/compliance.rs) | `sss-2.test.ts` → "should seize tokens from blacklisted account" |
| Transfer hook enforcement | [programs/sss-transfer-hook/src/lib.rs](../programs/sss-transfer-hook/src/lib.rs) | `sss-2.test.ts` → Transfer Hook Enforcement suite |
| Extra account meta list | [programs/sss-transfer-hook/src/lib.rs](../programs/sss-transfer-hook/src/lib.rs) `initialize_extra_account_meta_list` | N/A (deployed & verified) |

---

## BR-03: TypeScript SDK

**Status: Done**

| Feature | Implementation | Test |
|---------|---------------|------|
| SolanaStablecoin class | [sdk/core/src/stablecoin.ts](../sdk/core/src/stablecoin.ts) | `sdk.test.ts` |
| Preset configurations | [sdk/core/src/presets.ts](../sdk/core/src/presets.ts) | `sdk.test.ts` → Presets suite (8 tests) |
| Compliance module | [sdk/core/src/compliance.ts](../sdk/core/src/compliance.ts) | `sdk.test.ts` → SSS-2 compliance tests |
| PDA derivation helpers | [sdk/core/src/pda.ts](../sdk/core/src/pda.ts) | `sdk.test.ts` → PDA Derivation suite (5 tests) |
| Oracle module | [sdk/core/src/oracle.ts](../sdk/core/src/oracle.ts) | `oracle.test.ts` (18 tests) |
| Type definitions | [sdk/core/src/types.ts](../sdk/core/src/types.ts) | Used throughout |
| Package exports | [sdk/core/src/index.ts](../sdk/core/src/index.ts) | Import tests |

---

## BR-04: Admin CLI

**Status: Done**

| Command | Implementation | Description |
|---------|---------------|-------------|
| `init` | [cli/src/index.ts](../cli/src/index.ts) | Initialize SSS-1 or SSS-2 stablecoin |
| `mint` | [cli/src/index.ts](../cli/src/index.ts) | Mint tokens to recipient |
| `burn` | [cli/src/index.ts](../cli/src/index.ts) | Burn tokens from own account |
| `freeze` | [cli/src/index.ts](../cli/src/index.ts) | Freeze a token account |
| `thaw` | [cli/src/index.ts](../cli/src/index.ts) | Thaw a frozen account |
| `pause` | [cli/src/index.ts](../cli/src/index.ts) | Global pause all operations |
| `unpause` | [cli/src/index.ts](../cli/src/index.ts) | Resume operations |
| `blacklist add` | [cli/src/index.ts](../cli/src/index.ts) | Add address to blacklist |
| `blacklist remove` | [cli/src/index.ts](../cli/src/index.ts) | Remove from blacklist |
| `seize` | [cli/src/index.ts](../cli/src/index.ts) | Seize tokens from blacklisted account |
| `status` | [cli/src/index.ts](../cli/src/index.ts) | Show stablecoin status |
| `supply` | [cli/src/index.ts](../cli/src/index.ts) | Show total supply |

---

## BR-05: Backend Services (Dockerized)

**Status: Done**

| Service | Port | Implementation |
|---------|------|---------------|
| Mint/Burn API | 3001 | [services/src/mint-burn.ts](../services/src/mint-burn.ts) |
| Indexer | 3002 | [services/src/indexer.ts](../services/src/indexer.ts) |
| Compliance | 3003 | [services/src/compliance.ts](../services/src/compliance.ts) |
| Webhook | 3004 | [services/src/webhook.ts](../services/src/webhook.ts) |
| Dockerfile | — | [services/Dockerfile](../services/Dockerfile) |
| docker-compose | — | [services/docker-compose.yml](../services/docker-compose.yml) |

---

## BR-06: Documentation

**Status: Done**

| Document | Path | Content |
|----------|------|---------|
| README | [README.md](../README.md) | Overview, quick start, presets, architecture |
| Architecture | [docs/ARCHITECTURE.md](ARCHITECTURE.md) | Layer model, PDAs, data flows |
| SDK Reference | [docs/SDK.md](SDK.md) | TypeScript SDK API |
| SSS-1 Spec | [docs/SSS-1.md](SSS-1.md) | Minimal preset specification |
| SSS-2 Spec | [docs/SSS-2.md](SSS-2.md) | Compliant preset specification |
| Compliance | [docs/COMPLIANCE.md](COMPLIANCE.md) | Regulatory context, audit trail |
| Operations | [docs/OPERATIONS.md](OPERATIONS.md) | Deployment and run guide |
| API Reference | [docs/API.md](API.md) | Backend service routes |
| Deployment | [docs/DEPLOYMENT.md](DEPLOYMENT.md) | Deploy evidence, program IDs, tx sigs |
| Security | [docs/SECURITY.md](SECURITY.md) | Access control, threat model |
| Testing | [docs/TESTING.md](TESTING.md) | Test strategy and coverage |
| Oracle | [docs/ORACLE.md](ORACLE.md) | Oracle module documentation |
| Traceability | [docs/REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md) | This document |

---

## BR-07: Devnet Deployment Proof

**Status: Done**

| Program | Program ID | Deploy Tx |
|---------|-----------|-----------|
| sss-token | `3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk` | `EPBXQBD7HwBzicEQLHzskgsjgeKrHMGmLkzpquJLYf5SpC998Pi9fKZuE3g7hWC6dWfSQJMsgLyFw4pN6g83mm4` |
| sss-transfer-hook | `J8sRn7M35NfUi511JY3Hnw4dPBm9UvwmpKCBrAbzCMKq` | `2TZFJQqde2nsS5ScLSgsvmWbkxjhpXLQ3sLiwfsxS4rdxEo3qMfJLxeqgKnRgSZ1JBCUHsf6ETbwi4H5djqWWC3q` |
| sss-oracle | `2kouVKq1aQhwntSkTjgA8Nh6wtuxyYL1MjMnyA6srnGr` | Compiled (.so built, pending devnet SOL for deploy) |

Explorer links:
- [sss-token on Explorer](https://explorer.solana.com/address/3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk?cluster=devnet)
- [sss-transfer-hook on Explorer](https://explorer.solana.com/address/J8sRn7M35NfUi511JY3Hnw4dPBm9UvwmpKCBrAbzCMKq?cluster=devnet)

---

## BR-08: Tests

**Status: Done**

| Suite | File | Test Count |
|-------|------|-----------|
| SSS-1 Lifecycle | `tests/sss-1.test.ts` | 17 |
| SSS-2 Compliance | `tests/sss-2.test.ts` | 15 |
| SDK Unit | `tests/sdk.test.ts` | 12 |
| Oracle Unit | `tests/oracle.test.ts` | 18 |
| Extended Unit | `tests/extended.test.ts` | 20 |
| **Total** | | **82** |

---

## Bonus: Oracle Integration Module

**Status: Done**

| Component | Implementation |
|-----------|---------------|
| On-chain program | [programs/sss-oracle/](../programs/sss-oracle/) |
| Initialize oracle | [programs/sss-oracle/src/instructions/initialize.rs](../programs/sss-oracle/src/instructions/initialize.rs) |
| Compute mint amount | [programs/sss-oracle/src/instructions/compute.rs](../programs/sss-oracle/src/instructions/compute.rs) |
| Compute redeem amount | [programs/sss-oracle/src/instructions/compute.rs](../programs/sss-oracle/src/instructions/compute.rs) |
| Read price feed | [programs/sss-oracle/src/instructions/read_feed.rs](../programs/sss-oracle/src/instructions/read_feed.rs) |
| SDK helpers | [sdk/core/src/oracle.ts](../sdk/core/src/oracle.ts) |
| Documentation | [docs/ORACLE.md](ORACLE.md) |
| Tests | `tests/oracle.test.ts` (18 tests) |
