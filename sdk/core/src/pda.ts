import { PublicKey } from "@solana/web3.js";

const SSS_TOKEN_PROGRAM_ID = new PublicKey(
  "3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk"
);

const SSS_TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  "J8sRn7M35NfUi511JY3Hnw4dPBm9UvwmpKCBrAbzCMKq"
);

export function findStablecoinConfigPDA(
  mint: PublicKey,
  programId: PublicKey = SSS_TOKEN_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stablecoin"), mint.toBuffer()],
    programId
  );
}

export function findMinterConfigPDA(
  stablecoinConfig: PublicKey,
  minter: PublicKey,
  programId: PublicKey = SSS_TOKEN_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("minter"),
      stablecoinConfig.toBuffer(),
      minter.toBuffer(),
    ],
    programId
  );
}

export function findBlacklistEntryPDA(
  stablecoinConfig: PublicKey,
  address: PublicKey,
  programId: PublicKey = SSS_TOKEN_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("blacklist"),
      stablecoinConfig.toBuffer(),
      address.toBuffer(),
    ],
    programId
  );
}

export function findExtraAccountMetaListPDA(
  mint: PublicKey,
  programId: PublicKey = SSS_TRANSFER_HOOK_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.toBuffer()],
    programId
  );
}
