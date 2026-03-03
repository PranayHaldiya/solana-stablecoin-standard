use anchor_lang::prelude::*;

#[error_code]
pub enum OracleError {
    #[msg("Price feed is stale")]
    StaleFeed,

    #[msg("Oracle is not active")]
    OracleInactive,

    #[msg("Invalid price (zero or negative)")]
    InvalidPrice,

    #[msg("Peg asset name too long")]
    PegAssetTooLong,

    #[msg("Math overflow during computation")]
    MathOverflow,

    #[msg("Unauthorized - caller is not the oracle authority")]
    Unauthorized,

    #[msg("Invalid feed account data")]
    InvalidFeedData,

    #[msg("Amount must be greater than zero")]
    ZeroAmount,
}
