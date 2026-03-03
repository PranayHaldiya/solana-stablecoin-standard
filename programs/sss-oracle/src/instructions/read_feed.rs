use anchor_lang::prelude::*;
use crate::state::{OracleConfig, PriceData};
use crate::error::OracleError;

#[derive(Accounts)]
pub struct ReadFeed<'info> {
    #[account(
        mut,
        seeds = [b"oracle", oracle_config.mint.as_ref()],
        bump = oracle_config.bump,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    /// The price feed account.
    /// CHECK: Validated against oracle_config.price_feed
    #[account(
        constraint = price_feed.key() == oracle_config.price_feed @ OracleError::InvalidFeedData
    )]
    pub price_feed: UncheckedAccount<'info>,
}

pub fn read_feed_handler(ctx: Context<ReadFeed>) -> Result<()> {
    let oracle = &mut ctx.accounts.oracle_config;
    require!(oracle.active, OracleError::OracleInactive);

    let feed_data = ctx.accounts.price_feed.try_borrow_data()?;

    // Read price from feed account (generic format)
    require!(feed_data.len() >= 24, OracleError::InvalidFeedData);

    let price = i64::from_le_bytes(
        feed_data[8..16].try_into().map_err(|_| OracleError::InvalidFeedData)?
    );
    let timestamp = i64::from_le_bytes(
        feed_data[16..24].try_into().map_err(|_| OracleError::InvalidFeedData)?
    );

    require!(price > 0, OracleError::InvalidPrice);

    // Check staleness
    let clock = Clock::get()?;
    if oracle.max_staleness_seconds > 0 {
        let age = clock.unix_timestamp.saturating_sub(timestamp);
        require!(age <= oracle.max_staleness_seconds, OracleError::StaleFeed);
    }

    // Cache the latest price
    oracle.last_price = price;
    oracle.last_updated_at = timestamp;

    // Return price data via set_return_data
    let price_data = PriceData {
        price,
        decimals: oracle.feed_decimals,
        timestamp,
        peg_asset: oracle.peg_asset.clone(),
    };

    let serialized = price_data.try_to_vec().map_err(|_| OracleError::InvalidFeedData)?;
    solana_program::program::set_return_data(&serialized);

    msg!(
        "Oracle price for {}: {} (decimals: {}, ts: {})",
        oracle.peg_asset,
        price,
        oracle.feed_decimals,
        timestamp
    );

    Ok(())
}
