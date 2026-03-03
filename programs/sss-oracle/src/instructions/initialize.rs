use anchor_lang::prelude::*;
use crate::state::{OracleConfig, OracleInitConfig};
use crate::error::OracleError;

#[derive(Accounts)]
#[instruction(config: OracleInitConfig)]
pub struct InitializeOracle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The stablecoin mint this oracle serves
    /// CHECK: Validated by the caller — this is the Token-2022 mint address
    pub mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = OracleConfig::LEN,
        seeds = [b"oracle", mint.key().as_ref()],
        bump,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_oracle_handler(ctx: Context<InitializeOracle>, config: OracleInitConfig) -> Result<()> {
    require!(
        config.peg_asset.len() <= OracleConfig::MAX_PEG_ASSET_LEN,
        OracleError::PegAssetTooLong
    );

    let oracle = &mut ctx.accounts.oracle_config;
    oracle.mint = ctx.accounts.mint.key();
    oracle.authority = ctx.accounts.authority.key();
    oracle.price_feed = config.price_feed;
    oracle.peg_asset = config.peg_asset;
    oracle.feed_decimals = config.feed_decimals;
    oracle.stablecoin_decimals = config.stablecoin_decimals;
    oracle.max_staleness_seconds = config.max_staleness_seconds;
    oracle.active = true;
    oracle.last_price = 0;
    oracle.last_updated_at = 0;
    oracle.bump = ctx.bumps.oracle_config;
    oracle._reserved = [0u8; 64];

    msg!(
        "Oracle initialized for mint {} with peg asset {}",
        oracle.mint,
        oracle.peg_asset
    );

    Ok(())
}
