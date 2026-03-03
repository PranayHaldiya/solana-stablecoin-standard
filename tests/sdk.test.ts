import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import {
  findStablecoinConfigPDA,
  findMinterConfigPDA,
  findBlacklistEntryPDA,
  findExtraAccountMetaListPDA,
} from "../sdk/core/src/pda";
import { Presets } from "../sdk/core/src/presets";

/**
 * SDK Unit Tests
 * 
 * Tests SDK helper functions, PDA derivation, and preset configuration.
 */
describe("SDK Unit Tests", () => {
  const SSS_PROGRAM = new PublicKey(
    "3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk"
  );
  const SSS_HOOK_PROGRAM = new PublicKey(
    "J8sRn7M35NfUi511JY3Hnw4dPBm9UvwmpKCBrAbzCMKq"
  );
  const fakeMint = PublicKey.unique();
  const fakeUser = PublicKey.unique();

  describe("PDA Derivation", () => {
    it("should derive stablecoin config PDA deterministically", () => {
      const [pda1, bump1] = findStablecoinConfigPDA(fakeMint, SSS_PROGRAM);
      const [pda2, bump2] = findStablecoinConfigPDA(fakeMint, SSS_PROGRAM);

      expect(pda1.toBase58()).to.equal(pda2.toBase58());
      expect(bump1).to.equal(bump2);
    });

    it("should derive different PDAs for different mints", () => {
      const mint2 = PublicKey.unique();
      const [pda1] = findStablecoinConfigPDA(fakeMint, SSS_PROGRAM);
      const [pda2] = findStablecoinConfigPDA(mint2, SSS_PROGRAM);

      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });

    it("should derive minter config PDA", () => {
      const [configPDA] = findStablecoinConfigPDA(fakeMint, SSS_PROGRAM);
      const [minterPDA, bump] = findMinterConfigPDA(
        configPDA,
        fakeUser,
        SSS_PROGRAM
      );

      expect(minterPDA).to.be.instanceOf(PublicKey);
      expect(bump).to.be.a("number");
    });

    it("should derive blacklist entry PDA", () => {
      const [configPDA] = findStablecoinConfigPDA(fakeMint, SSS_PROGRAM);
      const [blacklistPDA, bump] = findBlacklistEntryPDA(
        configPDA,
        fakeUser,
        SSS_PROGRAM
      );

      expect(blacklistPDA).to.be.instanceOf(PublicKey);
      expect(bump).to.be.a("number");
    });

    it("should derive extra account meta list PDA", () => {
      const [metaPDA, bump] = findExtraAccountMetaListPDA(
        fakeMint,
        SSS_HOOK_PROGRAM
      );

      expect(metaPDA).to.be.instanceOf(PublicKey);
      expect(bump).to.be.a("number");
    });
  });

  describe("Presets", () => {
    it("should have SSS-1 preset", () => {
      const sss1 = Presets.SSS_1;
      expect(sss1.name).to.equal("SSS-1");
      expect(sss1.defaults.enablePermanentDelegate).to.be.false;
      expect(sss1.defaults.enableTransferHook).to.be.false;
      expect(sss1.defaults.decimals).to.equal(6);
    });

    it("should have SSS-2 preset", () => {
      const sss2 = Presets.SSS_2;
      expect(sss2.name).to.equal("SSS-2");
      expect(sss2.defaults.enablePermanentDelegate).to.be.true;
      expect(sss2.defaults.enableTransferHook).to.be.true;
      expect(sss2.defaults.decimals).to.equal(6);
    });

    it("should get preset by name", () => {
      const p = Presets.get("SSS-1");
      expect(p.name).to.equal("SSS-1");

      const p2 = Presets.get("SSS-2");
      expect(p2.name).to.equal("SSS-2");
    });

    it("should throw for unknown preset", () => {
      expect(() => Presets.get("SSS-99" as any)).to.throw("Unknown preset");
    });

    it("should list all presets", () => {
      const all = Presets.list();
      expect(all).to.have.length(2);
      expect(all[0].name).to.equal("SSS-1");
      expect(all[1].name).to.equal("SSS-2");
    });

    it("SSS-1 should not include compliance features", () => {
      const sss1 = Presets.SSS_1;
      expect(sss1.features).to.not.include("permanent_delegate");
      expect(sss1.features).to.not.include("transfer_hook");
      expect(sss1.features).to.not.include("blacklist");
      expect(sss1.features).to.include("mint_authority");
      expect(sss1.features).to.include("freeze_authority");
    });

    it("SSS-2 should include compliance features", () => {
      const sss2 = Presets.SSS_2;
      expect(sss2.features).to.include("permanent_delegate");
      expect(sss2.features).to.include("transfer_hook");
      expect(sss2.features).to.include("blacklist");
      expect(sss2.features).to.include("token_seizure");
    });
  });
});
