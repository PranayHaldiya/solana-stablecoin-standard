use anchor_lang::prelude::*;

use crate::constants::*;
use crate::state::{StablecoinConfig, BlacklistEntry};

#[derive(Accounts)]
pub struct ViewStablecoin<'info> {
    #[account(
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,
}

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct CheckBlacklist<'info> {
    #[account(
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [BLACKLIST_SEED, stablecoin_config.key().as_ref(), address.as_ref()],
        bump = blacklist_entry.bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
}

pub fn get_supply_handler(ctx: Context<ViewStablecoin>) -> Result<()> {
    let config = &ctx.accounts.stablecoin_config;
    let net_supply = config.total_minted
        .checked_sub(config.total_burned)
        .unwrap_or(0);

    msg!("Total minted: {}", config.total_minted);
    msg!("Total burned: {}", config.total_burned);
    msg!("Net supply: {}", net_supply);
    msg!("Paused: {}", config.paused);
    Ok(())
}

pub fn check_blacklist_handler(ctx: Context<CheckBlacklist>, address: Pubkey) -> Result<()> {
    let entry = &ctx.accounts.blacklist_entry;
    let is_blacklisted = entry.address == address && entry.address != Pubkey::default();

    msg!("Address {}: blacklisted={}", address, is_blacklisted);
    if is_blacklisted {
        msg!("Reason: {}", entry.reason);
    }
    Ok(())
}
