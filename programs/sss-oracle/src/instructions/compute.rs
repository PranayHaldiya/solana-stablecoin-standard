use anchor_lang::prelude::*;
use crate::state::{OracleConfig, ComputedAmount};
use crate::error::OracleError;

#[derive(Accounts)]
pub struct ComputeAmount<'info> {
    #[account(
        seeds = [b"oracle", oracle_config.mint.as_ref()],
        bump = oracle_config.bump,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    /// The price feed account to read from.
    /// CHECK: Validated against oracle_config.price_feed
    #[account(
        constraint = price_feed.key() == oracle_config.price_feed @ OracleError::InvalidFeedData
    )]
    pub price_feed: UncheckedAccount<'info>,
}

/// Read a price from a generic price feed account.
/// Supports Switchboard-style feeds where:
/// - Bytes 0..8: discriminator
/// - Bytes 8..16: price as i64 (little-endian)
/// - Bytes 16..24: timestamp as i64 (little-endian)
fn read_price_from_feed(
    feed_data: &[u8],
    max_staleness: i64,
    current_time: i64,
) -> Result<(i64, i64)> {
    // Minimum account data: 8 (disc) + 8 (price) + 8 (ts) = 24 bytes
    require!(feed_data.len() >= 24, OracleError::InvalidFeedData);

    let price = i64::from_le_bytes(
        feed_data[8..16].try_into().map_err(|_| OracleError::InvalidFeedData)?
    );
    let timestamp = i64::from_le_bytes(
        feed_data[16..24].try_into().map_err(|_| OracleError::InvalidFeedData)?
    );

    require!(price > 0, OracleError::InvalidPrice);

    // Check staleness
    if max_staleness > 0 {
        let age = current_time.saturating_sub(timestamp);
        require!(age <= max_staleness, OracleError::StaleFeed);
    }

    Ok((price, timestamp))
}

/// Compute the stablecoin amount to mint given a collateral input.
///
/// Formula: stablecoin_amount = collateral_amount * price / 10^feed_decimals
///
/// The price represents how many stablecoin base units one unit of collateral is worth.
/// For example, if price_feed returns 5.50 BRL/USD (scaled as 550 with 2 decimals),
/// then 1_000_000 USD collateral (6 decimals) → 5_500_000 BRL stablecoins (6 decimals).
pub fn compute_mint_handler(
    ctx: Context<ComputeAmount>,
    collateral_amount: u64,
) -> Result<()> {
    require!(collateral_amount > 0, OracleError::ZeroAmount);

    let oracle = &ctx.accounts.oracle_config;
    require!(oracle.active, OracleError::OracleInactive);

    let feed_data = ctx.accounts.price_feed.try_borrow_data()?;
    let clock = Clock::get()?;
    let (price, _timestamp) = read_price_from_feed(
        &feed_data,
        oracle.max_staleness_seconds,
        clock.unix_timestamp,
    )?;

    let feed_scale = 10u128.pow(oracle.feed_decimals as u32);
    let output = (collateral_amount as u128)
        .checked_mul(price as u128)
        .ok_or(OracleError::MathOverflow)?
        .checked_div(feed_scale)
        .ok_or(OracleError::MathOverflow)?;

    let output_amount = u64::try_from(output).map_err(|_| OracleError::MathOverflow)?;

    let result = ComputedAmount {
        input_amount: collateral_amount,
        output_amount,
        price_used: price,
        price_decimals: oracle.feed_decimals,
    };

    let serialized = result.try_to_vec().map_err(|_| OracleError::MathOverflow)?;
    solana_program::program::set_return_data(&serialized);

    msg!(
        "Compute mint: {} collateral → {} stablecoin (price: {})",
        collateral_amount,
        output_amount,
        price
    );

    Ok(())
}

/// Compute the collateral amount to release given stablecoin burn input.
///
/// Formula: collateral_amount = stablecoin_amount * 10^feed_decimals / price
pub fn compute_redeem_handler(
    ctx: Context<ComputeAmount>,
    stablecoin_amount: u64,
) -> Result<()> {
    require!(stablecoin_amount > 0, OracleError::ZeroAmount);

    let oracle = &ctx.accounts.oracle_config;
    require!(oracle.active, OracleError::OracleInactive);

    let feed_data = ctx.accounts.price_feed.try_borrow_data()?;
    let clock = Clock::get()?;
    let (price, _timestamp) = read_price_from_feed(
        &feed_data,
        oracle.max_staleness_seconds,
        clock.unix_timestamp,
    )?;

    let feed_scale = 10u128.pow(oracle.feed_decimals as u32);
    let output = (stablecoin_amount as u128)
        .checked_mul(feed_scale)
        .ok_or(OracleError::MathOverflow)?
        .checked_div(price as u128)
        .ok_or(OracleError::MathOverflow)?;

    let output_amount = u64::try_from(output).map_err(|_| OracleError::MathOverflow)?;

    let result = ComputedAmount {
        input_amount: stablecoin_amount,
        output_amount,
        price_used: price,
        price_decimals: oracle.feed_decimals,
    };

    let serialized = result.try_to_vec().map_err(|_| OracleError::MathOverflow)?;
    solana_program::program::set_return_data(&serialized);

    msg!(
        "Compute redeem: {} stablecoin → {} collateral (price: {})",
        stablecoin_amount,
        output_amount,
        price
    );

    Ok(())
}
