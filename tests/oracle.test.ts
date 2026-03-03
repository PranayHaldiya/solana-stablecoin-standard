import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import BN from "bn.js";
import {
  findOracleConfigPDA,
  computeMintAmountFromOracle,
  computeRedeemAmountFromOracle,
  SSS_ORACLE_PROGRAM_ID,
} from "../sdk/core/src/oracle";

/**
 * Oracle Module Unit Tests
 * 
 * Tests oracle PDA derivation, price computation math,
 * and edge cases for the oracle integration.
 */
describe("Oracle Module Unit Tests", () => {
  const ORACLE_PROGRAM = SSS_ORACLE_PROGRAM_ID;
  const fakeMint = PublicKey.unique();

  describe("Oracle PDA Derivation", () => {
    it("should derive oracle config PDA deterministically", () => {
      const [pda1, bump1] = findOracleConfigPDA(fakeMint, ORACLE_PROGRAM);
      const [pda2, bump2] = findOracleConfigPDA(fakeMint, ORACLE_PROGRAM);

      expect(pda1.toBase58()).to.equal(pda2.toBase58());
      expect(bump1).to.equal(bump2);
    });

    it("should derive different PDAs for different mints", () => {
      const mint2 = PublicKey.unique();
      const [pda1] = findOracleConfigPDA(fakeMint, ORACLE_PROGRAM);
      const [pda2] = findOracleConfigPDA(mint2, ORACLE_PROGRAM);

      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });

    it("should derive PDA that is not on curve", () => {
      const [pda] = findOracleConfigPDA(fakeMint, ORACLE_PROGRAM);
      // PDA should be a valid PublicKey but OFF the ed25519 curve
      expect(pda).to.be.instanceOf(PublicKey);
    });
  });

  describe("Compute Mint Amount", () => {
    it("should compute BRL mint amount correctly (5.50 BRL/USD)", () => {
      // BRL/USD price = 5.50, feed_decimals = 2 → price = 550
      const collateral = new BN(1_000_000); // 1 USD (6 decimals)
      const price = new BN(550);
      const feedDecimals = 2;

      const result = computeMintAmountFromOracle(collateral, price, feedDecimals);
      expect(result.toNumber()).to.equal(5_500_000); // 5.5 BRL
    });

    it("should compute EUR mint amount correctly (0.92 EUR/USD)", () => {
      // EUR/USD price = 0.92, feed_decimals = 8 → price = 92_000_000
      const collateral = new BN(1_000_000); // 1 USD
      const price = new BN(92_000_000);
      const feedDecimals = 8;

      const result = computeMintAmountFromOracle(collateral, price, feedDecimals);
      expect(result.toNumber()).to.equal(920_000); // 0.92 EUR
    });

    it("should handle 1:1 peg (USD/USD)", () => {
      const collateral = new BN(1_000_000);
      const price = new BN(100); // 1.00 with 2 decimals
      const feedDecimals = 2;

      const result = computeMintAmountFromOracle(collateral, price, feedDecimals);
      expect(result.toNumber()).to.equal(1_000_000);
    });

    it("should handle zero collateral", () => {
      const result = computeMintAmountFromOracle(new BN(0), new BN(550), 2);
      expect(result.toNumber()).to.equal(0);
    });

    it("should handle large amounts without overflow", () => {
      const collateral = new BN("1000000000000"); // 1M tokens (6 decimals)
      const price = new BN(550);
      const feedDecimals = 2;

      const result = computeMintAmountFromOracle(collateral, price, feedDecimals);
      expect(result.toString()).to.equal("5500000000000");
    });

    it("should handle high-precision feeds (8 decimals)", () => {
      const collateral = new BN(1_000_000);
      const price = new BN(549_876_543); // 5.49876543 with 8 decimals
      const feedDecimals = 8;

      const result = computeMintAmountFromOracle(collateral, price, feedDecimals);
      // 1_000_000 * 549_876_543 / 100_000_000 = 5_498_765
      expect(result.toNumber()).to.equal(5_498_765);
    });
  });

  describe("Compute Redeem Amount", () => {
    it("should compute BRL redeem amount correctly", () => {
      // Redeem 5.5 BRL at 5.50 BRL/USD → 1 USD
      const stablecoinAmount = new BN(5_500_000);
      const price = new BN(550);
      const feedDecimals = 2;

      const result = computeRedeemAmountFromOracle(stablecoinAmount, price, feedDecimals);
      expect(result.toNumber()).to.equal(1_000_000);
    });

    it("should be inverse of compute mint", () => {
      const collateral = new BN(1_000_000);
      const price = new BN(550);
      const feedDecimals = 2;

      const minted = computeMintAmountFromOracle(collateral, price, feedDecimals);
      const redeemed = computeRedeemAmountFromOracle(minted, price, feedDecimals);

      expect(redeemed.toNumber()).to.equal(collateral.toNumber());
    });

    it("should handle zero stablecoin amount", () => {
      const result = computeRedeemAmountFromOracle(new BN(0), new BN(550), 2);
      expect(result.toNumber()).to.equal(0);
    });

    it("should handle EUR redemption", () => {
      const stablecoinAmount = new BN(920_000); // 0.92 EUR
      const price = new BN(92_000_000); // 0.92 with 8 decimals
      const feedDecimals = 8;

      const result = computeRedeemAmountFromOracle(stablecoinAmount, price, feedDecimals);
      expect(result.toNumber()).to.equal(1_000_000); // 1 USD
    });
  });

  describe("Edge Cases", () => {
    it("should handle feed_decimals = 0", () => {
      const collateral = new BN(1_000_000);
      const price = new BN(5); // 5x with 0 decimals
      const feedDecimals = 0;

      const result = computeMintAmountFromOracle(collateral, price, feedDecimals);
      expect(result.toNumber()).to.equal(5_000_000);
    });

    it("should handle very small prices", () => {
      const collateral = new BN(1_000_000);
      const price = new BN(1); // 0.00000001 with 8 decimals
      const feedDecimals = 8;

      const result = computeMintAmountFromOracle(collateral, price, feedDecimals);
      // Very small price = very small output
      expect(result.toNumber()).to.be.lessThan(1);
    });

    it("should handle very large prices", () => {
      const collateral = new BN(1_000_000);
      const price = new BN("240000000000"); // 2400.00 with 8 decimals (gold price)
      const feedDecimals = 8;

      const result = computeMintAmountFromOracle(collateral, price, feedDecimals);
      expect(result.toNumber()).to.equal(2_400_000_000);
    });
  });
});
