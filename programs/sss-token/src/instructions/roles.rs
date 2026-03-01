use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::{MinterUpdated, RoleUpdated};
use crate::state::{StablecoinConfig, MinterConfig, RoleType};

#[derive(Accounts)]
#[instruction(minter: Pubkey, quota: u64, active: bool)]
pub struct UpdateMinter<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
        constraint = authority.key() == stablecoin_config.authority @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        init_if_needed,
        payer = authority,
        space = MinterConfig::LEN,
        seeds = [MINTER_SEED, stablecoin_config.key().as_ref(), minter.as_ref()],
        bump,
    )]
    pub minter_config: Account<'info, MinterConfig>,

    pub system_program: Program<'info, System>,
}

pub fn update_minter_handler(
    ctx: Context<UpdateMinter>,
    minter: Pubkey,
    quota: u64,
    active: bool,
) -> Result<()> {
    let minter_config = &mut ctx.accounts.minter_config;

    minter_config.stablecoin = ctx.accounts.stablecoin_config.key();
    minter_config.minter = minter;
    minter_config.quota = quota;
    minter_config.active = active;
    minter_config.bump = ctx.bumps.minter_config;

    emit!(MinterUpdated {
        mint: ctx.accounts.stablecoin_config.mint,
        minter,
        quota,
        active,
    });

    msg!("Minter {} updated: quota={}, active={}", minter, quota, active);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateRoles<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
        constraint = authority.key() == stablecoin_config.authority @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,
}

pub fn update_roles_handler(
    ctx: Context<UpdateRoles>,
    role: RoleType,
    account: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.stablecoin_config;

    let role_name = match role {
        RoleType::Pauser => {
            config.pauser = account;
            "pauser"
        }
        RoleType::Blacklister => {
            require!(config.is_sss2(), StablecoinError::ComplianceNotEnabled);
            config.blacklister = account;
            "blacklister"
        }
        RoleType::Seizer => {
            require!(config.is_sss2(), StablecoinError::ComplianceNotEnabled);
            config.seizer = account;
            "seizer"
        }
    };

    emit!(RoleUpdated {
        mint: config.mint,
        role: role_name.to_string(),
        account,
    });

    msg!("Role {} updated to {}", role_name, account);
    Ok(())
}
