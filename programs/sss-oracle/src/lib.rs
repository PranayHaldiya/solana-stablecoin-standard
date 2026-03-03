use anchor_lang::prelude::*;

pub mod state;
pub mod error;
pub mod instructions;

use instructions::*;
use state::OracleInitConfig;

declare_id!("2kouVKq1aQhwntSkTjgA8Nh6wtuxyYL1MjMnyA6srnGr");

#[program]
pub mod sss_oracle {
    use super::*;

    /// Initialize an oracle configuration for a stablecoin mint.
    /// Links a price feed to a stablecoin for non-USD peg pricing.
    pub fn initialize_oracle(
        ctx: Context<InitializeOracle>,
        config: OracleInitConfig,
    ) -> Result<()> {
        instructions::initialize::initialize_oracle_handler(ctx, config)
    }

    /// Update the price feed address (authority only).
    pub fn update_feed(
        ctx: Context<UpdateFeed>,
        new_feed: Pubkey,
    ) -> Result<()> {
        instructions::update_feed::update_feed_handler(ctx, new_feed)
    }

    /// Compute mint amount from oracle price.
    /// Given a collateral amount (in base units), returns the stablecoin amount
    /// to mint based on the current oracle price.
    /// Result is returned via `set_return_data`.
    pub fn compute_mint_amount(
        ctx: Context<ComputeAmount>,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::compute::compute_mint_handler(ctx, collateral_amount)
    }

    /// Compute redeem amount from oracle price.
    /// Given a stablecoin amount to burn, returns the collateral amount
    /// to release based on the current oracle price.
    /// Result is returned via `set_return_data`.
    pub fn compute_redeem_amount(
        ctx: Context<ComputeAmount>,
        stablecoin_amount: u64,
    ) -> Result<()> {
        instructions::compute::compute_redeem_handler(ctx, stablecoin_amount)
    }

    /// Read the current price from the oracle feed.
    /// Returns price data via `set_return_data`.
    pub fn read_feed(
        ctx: Context<ReadFeed>,
    ) -> Result<()> {
        instructions::read_feed::read_feed_handler(ctx)
    }
}
