import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import {
  findStablecoinConfigPDA,
  findMinterConfigPDA,
  findBlacklistEntryPDA,
  findExtraAccountMetaListPDA,
} from "../sdk/core/src/pda";
import { Presets } from "../sdk/core/src/presets";
import { findOracleConfigPDA, SSS_ORACLE_PROGRAM_ID } from "../sdk/core/src/oracle";

/**
 * Extended Unit Tests
 *
 * Additional error condition, boundary, and configuration tests
 * to increase coverage for the Solana Stablecoin Standard.
 */
describe("Extended Unit Tests", () => {
  const SSS_PROGRAM = new PublicKey(
    "3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk"
  );
  const SSS_HOOK_PROGRAM = new PublicKey(
    "J8sRn7M35NfUi511JY3Hnw4dPBm9UvwmpKCBrAbzCMKq"
  );

  describe("PDA Uniqueness", () => {
    it("should produce unique PDAs across all seed types for same mint", () => {
      const mint = PublicKey.unique();
      const user = PublicKey.unique();

      const [configPDA] = findStablecoinConfigPDA(mint, SSS_PROGRAM);
      const [minterPDA] = findMinterConfigPDA(configPDA, user, SSS_PROGRAM);
      const [blacklistPDA] = findBlacklistEntryPDA(configPDA, user, SSS_PROGRAM);
      const [hookPDA] = findExtraAccountMetaListPDA(mint, SSS_HOOK_PROGRAM);
      const [oraclePDA] = findOracleConfigPDA(mint, SSS_ORACLE_PROGRAM_ID);

      const pdas = [configPDA, minterPDA, blacklistPDA, hookPDA, oraclePDA];
      const unique = new Set(pdas.map((p) => p.toBase58()));
      expect(unique.size).to.equal(pdas.length);
    });

    it("should derive same minter PDA regardless of call order", () => {
      const mint = PublicKey.unique();
      const user1 = PublicKey.unique();
      const user2 = PublicKey.unique();
      const [configPDA] = findStablecoinConfigPDA(mint, SSS_PROGRAM);

      const [minter1a] = findMinterConfigPDA(configPDA, user1, SSS_PROGRAM);
      const [minter2] = findMinterConfigPDA(configPDA, user2, SSS_PROGRAM);
      const [minter1b] = findMinterConfigPDA(configPDA, user1, SSS_PROGRAM);

      expect(minter1a.toBase58()).to.equal(minter1b.toBase58());
      expect(minter1a.toBase58()).to.not.equal(minter2.toBase58());
    });
  });

  describe("Preset Validation", () => {
    it("SSS-1 preset has correct field count", () => {
      const sss1 = Presets.SSS_1;
      expect(sss1).to.have.property("name", "SSS-1");
      expect(sss1).to.have.property("defaults");
      expect(sss1.defaults).to.have.property("decimals");
      expect(sss1.defaults).to.have.property("enablePermanentDelegate");
      expect(sss1.defaults).to.have.property("enableTransferHook");
    });

    it("SSS-2 preset has correct field count", () => {
      const sss2 = Presets.SSS_2;
      expect(sss2).to.have.property("name", "SSS-2");
      expect(sss2).to.have.property("defaults");
      expect(sss2.defaults).to.have.property("decimals");
      expect(sss2.defaults).to.have.property("enablePermanentDelegate");
      expect(sss2.defaults).to.have.property("enableTransferHook");
    });

    it("SSS-1 decimals should be 6", () => {
      expect(Presets.SSS_1.defaults.decimals).to.equal(6);
    });

    it("SSS-2 decimals should be 6", () => {
      expect(Presets.SSS_2.defaults.decimals).to.equal(6);
    });

    it("SSS-1 and SSS-2 should have different compliance settings", () => {
      expect(Presets.SSS_1.defaults.enablePermanentDelegate).to.not.equal(
        Presets.SSS_2.defaults.enablePermanentDelegate
      );
    });

    it("getPreset should be case-sensitive", () => {
      expect(() => Presets.getPreset("sss-1")).to.throw();
      expect(() => Presets.getPreset("SSS-1")).to.not.throw();
    });

    it("listPresets should return array of length 2", () => {
      const list = Presets.listPresets();
      expect(list).to.be.an("array");
      expect(list.length).to.equal(2);
    });

    it("listPresets should contain both SSS-1 and SSS-2", () => {
      const names = Presets.listPresets().map((p: any) => p.name);
      expect(names).to.include("SSS-1");
      expect(names).to.include("SSS-2");
    });
  });

  describe("Program ID Validation", () => {
    it("SSS token program ID should be valid base58", () => {
      expect(SSS_PROGRAM.toBase58()).to.equal(
        "3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk"
      );
    });

    it("SSS transfer hook program ID should be valid base58", () => {
      expect(SSS_HOOK_PROGRAM.toBase58()).to.equal(
        "J8sRn7M35NfUi511JY3Hnw4dPBm9UvwmpKCBrAbzCMKq"
      );
    });

    it("SSS oracle program ID should be valid base58", () => {
      expect(SSS_ORACLE_PROGRAM_ID.toBase58()).to.equal(
        "2kouVKq1aQhwntSkTjgA8Nh6wtuxyYL1MjMnyA6srnGr"
      );
    });

    it("All three program IDs should be different", () => {
      const ids = new Set([
        SSS_PROGRAM.toBase58(),
        SSS_HOOK_PROGRAM.toBase58(),
        SSS_ORACLE_PROGRAM_ID.toBase58(),
      ]);
      expect(ids.size).to.equal(3);
    });
  });

  describe("Edge Cases - PDA with special inputs", () => {
    it("should handle mint address that is system program", () => {
      const systemProgram = new PublicKey("11111111111111111111111111111111");
      const [pda] = findStablecoinConfigPDA(systemProgram, SSS_PROGRAM);
      expect(pda).to.be.instanceOf(PublicKey);
    });

    it("should handle same pubkey for config and user in minter PDA", () => {
      const mint = PublicKey.unique();
      const [configPDA] = findStablecoinConfigPDA(mint, SSS_PROGRAM);
      // Use configPDA as both config and user (edge case)
      const [minterPDA] = findMinterConfigPDA(configPDA, configPDA, SSS_PROGRAM);
      expect(minterPDA).to.be.instanceOf(PublicKey);
    });

    it("should handle blacklist PDA for same address as config authority", () => {
      const mint = PublicKey.unique();
      const authority = PublicKey.unique();
      const [configPDA] = findStablecoinConfigPDA(mint, SSS_PROGRAM);
      const [blacklistPDA] = findBlacklistEntryPDA(configPDA, authority, SSS_PROGRAM);
      expect(blacklistPDA).to.be.instanceOf(PublicKey);
    });
  });

  describe("Preset Defaults Completeness", () => {
    it("SSS-1 should not enable default account frozen", () => {
      const defaults = Presets.SSS_1.defaults;
      if ("defaultAccountFrozen" in defaults) {
        expect(defaults.defaultAccountFrozen).to.equal(false);
      }
    });

    it("SSS-2 should be a superset of SSS-1 features", () => {
      const sss1 = Presets.SSS_1.defaults;
      const sss2 = Presets.SSS_2.defaults;

      // SSS-2 should enable everything SSS-1 has, plus more
      expect(sss2.decimals).to.equal(sss1.decimals);
      expect(sss2.enablePermanentDelegate).to.equal(true);
      expect(sss2.enableTransferHook).to.equal(true);
    });
  });
});
