use anchor_lang::prelude::*;
use crate::state::OracleConfig;
use crate::error::OracleError;

#[derive(Accounts)]
pub struct UpdateFeed<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"oracle", oracle_config.mint.as_ref()],
        bump = oracle_config.bump,
        has_one = authority @ OracleError::Unauthorized,
    )]
    pub oracle_config: Account<'info, OracleConfig>,
}

pub fn update_feed_handler(ctx: Context<UpdateFeed>, new_feed: Pubkey) -> Result<()> {
    let oracle = &mut ctx.accounts.oracle_config;
    oracle.price_feed = new_feed;

    msg!("Oracle feed updated to {}", new_feed);

    Ok(())
}
