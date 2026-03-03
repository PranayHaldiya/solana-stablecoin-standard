use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::{StablecoinPaused, StablecoinUnpaused, AuthorityTransferred};
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct AdminAction<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,
}

pub fn pause_handler(ctx: Context<AdminAction>) -> Result<()> {
    let config = &mut ctx.accounts.stablecoin_config;

    // Only authority or pauser can pause
    require!(
        ctx.accounts.authority.key() == config.authority
            || ctx.accounts.authority.key() == config.pauser,
        StablecoinError::Unauthorized
    );

    require!(!config.paused, StablecoinError::Paused);
    config.paused = true;

    emit!(StablecoinPaused {
        mint: config.mint,
        authority: ctx.accounts.authority.key(),
    });

    msg!("Stablecoin paused");
    Ok(())
}

pub fn unpause_handler(ctx: Context<AdminAction>) -> Result<()> {
    let config = &mut ctx.accounts.stablecoin_config;

    require!(
        ctx.accounts.authority.key() == config.authority
            || ctx.accounts.authority.key() == config.pauser,
        StablecoinError::Unauthorized
    );

    require!(config.paused, StablecoinError::NotPaused);
    config.paused = false;

    emit!(StablecoinUnpaused {
        mint: config.mint,
        authority: ctx.accounts.authority.key(),
    });

    msg!("Stablecoin unpaused");
    Ok(())
}

pub fn transfer_authority_handler(
    ctx: Context<AdminAction>,
    new_authority: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.stablecoin_config;

    require!(
        ctx.accounts.authority.key() == config.authority,
        StablecoinError::Unauthorized
    );

    let old_authority = config.authority;
    config.authority = new_authority;

    emit!(AuthorityTransferred {
        mint: config.mint,
        old_authority,
        new_authority,
    });

    msg!("Authority transferred to {}", new_authority);
    Ok(())
}
