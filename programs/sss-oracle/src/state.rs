use anchor_lang::prelude::*;

/// Oracle configuration PDA for a stablecoin
#[account]
pub struct OracleConfig {
    /// The stablecoin mint this oracle is linked to
    pub mint: Pubkey,
    /// Authority that can update the oracle config
    pub authority: Pubkey,
    /// Price feed account address (Switchboard / Pyth compatible)
    pub price_feed: Pubkey,
    /// Target peg asset name (e.g., "BRL", "EUR", "BTC")
    pub peg_asset: String,
    /// Feed decimals (precision of the price feed)
    pub feed_decimals: u8,
    /// Stablecoin decimals (for amount conversion)
    pub stablecoin_decimals: u8,
    /// Maximum staleness in seconds (reject stale prices)
    pub max_staleness_seconds: i64,
    /// Whether the oracle is active
    pub active: bool,
    /// Last known price (cached from last read)
    pub last_price: i64,
    /// Timestamp of last price update
    pub last_updated_at: i64,
    /// PDA bump
    pub bump: u8,
    /// Reserved for future use
    pub _reserved: [u8; 64],
}

impl OracleConfig {
    pub const MAX_PEG_ASSET_LEN: usize = 16;

    pub const LEN: usize = 8 +  // discriminator
        32 +  // mint
        32 +  // authority
        32 +  // price_feed
        (4 + Self::MAX_PEG_ASSET_LEN) + // peg_asset
        1 +   // feed_decimals
        1 +   // stablecoin_decimals
        8 +   // max_staleness_seconds
        1 +   // active
        8 +   // last_price
        8 +   // last_updated_at
        1 +   // bump
        64;   // _reserved
}

/// Oracle initialization parameters
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OracleInitConfig {
    /// Price feed account address
    pub price_feed: Pubkey,
    /// Target peg asset (e.g., "BRL", "EUR")
    pub peg_asset: String,
    /// Feed decimals
    pub feed_decimals: u8,
    /// Stablecoin decimals
    pub stablecoin_decimals: u8,
    /// Maximum staleness in seconds
    pub max_staleness_seconds: i64,
}

/// Price data returned via set_return_data
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PriceData {
    /// Current price (scaled by 10^feed_decimals)
    pub price: i64,
    /// Price decimals
    pub decimals: u8,
    /// Timestamp of the price
    pub timestamp: i64,
    /// Peg asset name
    pub peg_asset: String,
}

/// Computed amount returned via set_return_data
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ComputedAmount {
    /// Input amount
    pub input_amount: u64,
    /// Output amount (computed from oracle price)
    pub output_amount: u64,
    /// Price used for computation
    pub price_used: i64,
    /// Price decimals
    pub price_decimals: u8,
}
