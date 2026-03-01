use anchor_lang::prelude::*;

#[error_code]
pub enum StablecoinError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    #[msg("Token operations are paused")]
    Paused,

    #[msg("Token operations are not paused")]
    NotPaused,

    #[msg("Unauthorized - caller does not have required role")]
    Unauthorized,

    #[msg("Minter quota exceeded")]
    QuotaExceeded,

    #[msg("Address is blacklisted")]
    Blacklisted,

    #[msg("Address is not blacklisted")]
    NotBlacklisted,

    #[msg("Compliance module not enabled (SSS-2 required)")]
    ComplianceNotEnabled,

    #[msg("Transfer hook not enabled (SSS-2 required)")]
    TransferHookNotEnabled,

    #[msg("Permanent delegate not enabled (SSS-2 required)")]
    PermanentDelegateNotEnabled,

    #[msg("Invalid configuration")]
    InvalidConfig,

    #[msg("Name too long")]
    NameTooLong,

    #[msg("Symbol too long")]
    SymbolTooLong,

    #[msg("URI too long")]
    UriTooLong,

    #[msg("Reason too long")]
    ReasonTooLong,

    #[msg("Decimals must be <= 9")]
    InvalidDecimals,

    #[msg("Arithmetic overflow")]
    MathOverflow,

    #[msg("Minter not found")]
    MinterNotFound,

    #[msg("Account is frozen")]
    AccountFrozen,

    #[msg("Invalid authority")]
    InvalidAuthority,
}
