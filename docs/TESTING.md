# Testing Guide

This document describes the testing strategy, test suites, and how to run tests for the Solana Stablecoin Standard.

---

## Overview

The project includes **44 test cases** covering:

- **SSS-1 integration tests** — Full lifecycle of minimal stablecoins (17 tests)
- **SSS-2 integration tests** — Compliance features, transfer hooks, seizure (15 tests)
- **SDK unit tests** — PDA derivation, presets, configuration validation (12 tests)

```
tests/
├── sss-1.test.ts       # SSS-1 minimal stablecoin lifecycle
├── sss-2.test.ts       # SSS-2 compliant stablecoin with compliance
└── sdk.test.ts         # SDK unit tests (PDA, presets, helpers)
```

---

## Running Tests

### All Tests (via Anchor)

```bash
anchor test
```

This will:
1. Start a local validator
2. Build and deploy programs
3. Run all test suites
4. Report results

### Individual Test Suites

```bash
# SSS-1 lifecycle tests only
npx ts-mocha -p ./tsconfig.json tests/sss-1.test.ts --timeout 60000

# SSS-2 compliance tests only
npx ts-mocha -p ./tsconfig.json tests/sss-2.test.ts --timeout 60000

# SDK unit tests only (no validator needed)
npx ts-mocha -p ./tsconfig.json tests/sdk.test.ts --timeout 10000
```

---

## Test Coverage Matrix

### SSS-1: Minimal Stablecoin (17 tests)

| Category | Test | What It Validates |
|----------|------|-------------------|
| **Initialization** | Create Token-2022 mint | Mint creation with correct decimals and authority |
| | Initialize SSS-1 config | PDA creation, name/symbol/uri storage, role assignment |
| **Minter Management** | Add minter with quota | MinterConfig PDA creation, quota and active status |
| | Reject unauthorized minter update | Only master authority can add minters |
| **Minting** | Mint tokens to recipient | Token balance increases, minted counter tracks |
| | Reject minting when paused | Paused state blocks mint operations |
| | Reject minting over quota | Quota enforcement (minted + amount <= quota) |
| **Burning** | Burn tokens from caller | Balance decreases, burned counter updates |
| | Reject burning zero amount | ZeroAmount error validation |
| **Freeze/Thaw** | Freeze a token account | Account state changes to frozen |
| | Reject transfers from frozen | Frozen accounts cannot transfer |
| | Thaw a frozen account | Account returns to normal state |
| **Pause/Unpause** | Pause operations | Global pause flag set |
| | Reject mint/burn while paused | All mutable operations blocked |
| | Unpause operations | Global pause flag cleared |
| **Authority** | Transfer master authority | Authority pubkey changes atomically |
| | Reject transfer from non-authority | Only current authority can transfer |

### SSS-2: Compliant Stablecoin (15 tests)

| Category | Test | What It Validates |
|----------|------|-------------------|
| **Init with Extensions** | Create mint with permanent delegate + transfer hook | Token-2022 extension initialization |
| | Initialize SSS-2 config | Compliance flags enabled in config |
| **Blacklist** | Add address to blacklist | BlacklistEntry PDA created with reason, timestamp |
| | Reject duplicate blacklist entry | Cannot double-blacklist same address |
| | Check blacklist status | On-chain blacklist query works |
| | Remove from blacklist | BlacklistEntry PDA closed |
| **Transfer Hook** | Allow non-blacklisted transfers | Normal transfers pass hook check |
| | Block blacklisted sender | Hook rejects transfer from blacklisted source |
| | Block blacklisted recipient | Hook rejects transfer to blacklisted destination |
| **Seizure** | Seize from blacklisted account | Permanent delegate transfers tokens out |
| | Reject seizure from non-seizer | Only seizer role can seize |
| | Reject seizure on SSS-1 | Seizure requires SSS-2 compliance features |
| **Roles** | Update blacklister role | Master authority reassigns blacklister |
| | Update seizer role | Master authority reassigns seizer |
| **Full Lifecycle** | Complete compliance flow | Init → mint → blacklist → seize → unblacklist |

### SDK Unit Tests (12 tests)

| Category | Test | What It Validates |
|----------|------|-------------------|
| **PDA Derivation** | Deterministic config PDA | Same inputs produce same PDA |
| | Different PDAs per mint | Unique mint → unique PDA |
| | Minter config PDA | Correct seeds: [minter, config, pubkey] |
| | Blacklist entry PDA | Correct seeds: [blacklist, config, address] |
| | Extra account meta PDA | Correct seeds for transfer hook |
| **Presets** | SSS-1 preset exists | Correct defaults (no compliance) |
| | SSS-2 preset exists | Correct defaults (compliance enabled) |
| | Get preset by name | `getPreset("SSS-1")` works |
| | Throw for unknown preset | Unknown name throws error |
| | List all presets | `listPresets()` returns both |
| | SSS-1 no compliance | `enablePermanentDelegate` = false |
| | SSS-2 has compliance | `enablePermanentDelegate` = true |

---

## Error Condition Coverage

The test suite validates the following error paths:

| Error | Tested In | Test Description |
|-------|-----------|------------------|
| `Unauthorized` | sss-1.test.ts | Non-authority tries to add minter |
| `Unauthorized` | sss-2.test.ts | Non-seizer tries to seize tokens |
| `QuotaExceeded` | sss-1.test.ts | Minter tries to exceed quota |
| `Paused` | sss-1.test.ts | Mint/burn during global pause |
| `ZeroAmount` | sss-1.test.ts | Burn with amount = 0 |
| `ComplianceNotEnabled` | sss-2.test.ts | Seizure on SSS-1 stablecoin |
| `Blacklisted` | sss-2.test.ts | Transfer from/to blacklisted |

---

## Test Architecture

### Integration Tests (sss-1, sss-2)

Integration tests run against a local Solana validator with both programs deployed. They test **real on-chain instructions** via Anchor's testing framework.

```
┌──────────────────────────────┐
│      Test Runner (Mocha)     │
├──────────────────────────────┤
│      Anchor Provider         │
│   (RPC → local validator)    │
├──────────────────────────────┤
│    sss-token Program         │
│    sss-transfer-hook Program │
├──────────────────────────────┤
│    Solana Test Validator      │
└──────────────────────────────┘
```

### Unit Tests (SDK)

SDK unit tests run in Node.js without a validator. They test pure functions like PDA derivation and preset configuration.

---

## Adding New Tests

### Integration Test Template

```typescript
it("should do something new", async () => {
  const tx = await program.methods
    .instructionName(args)
    .accounts({
      authority: authority.publicKey,
      stablecoinConfig: stablecoinConfigPDA,
      // ... other accounts
    })
    .rpc();

  // Fetch and verify account state
  const config = await program.account.stablecoinConfig.fetch(stablecoinConfigPDA);
  expect(config.someField).to.equal(expectedValue);
});
```

### Error Test Template

```typescript
it("should reject unauthorized action", async () => {
  try {
    await program.methods
      .restrictedAction()
      .accounts({ authority: wrongKeypair.publicKey })
      .signers([wrongKeypair])
      .rpc();
    expect.fail("Should have thrown");
  } catch (err) {
    expect(err.error.errorCode.code).to.equal("Unauthorized");
  }
});
```

---

## CI / Continuous Testing

For CI pipelines, use:

```bash
# Install dependencies
npm install

# Build programs
anchor build

# Run tests with extended timeout
anchor test -- --timeout 120000
```
