use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
    FreezeAccount, ThawAccount,
    freeze_account, thaw_account,
};

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::{AccountFrozen, AccountThawed};
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct FreezeTokenAccount<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin_config.bump,
        constraint = authority.key() == stablecoin_config.authority
            || authority.key() == stablecoin_config.blacklister
            @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        constraint = mint.key() == stablecoin_config.mint @ StablecoinError::InvalidConfig,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn freeze_handler(ctx: Context<FreezeTokenAccount>) -> Result<()> {
    let mint_key = ctx.accounts.stablecoin_config.mint;
    let bump = ctx.accounts.stablecoin_config.bump;
    let seeds = &[
        STABLECOIN_SEED,
        mint_key.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    freeze_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            FreezeAccount {
                account: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.stablecoin_config.to_account_info(),
            },
            signer_seeds,
        ),
    )?;

    emit!(AccountFrozen {
        mint: ctx.accounts.mint.key(),
        account: ctx.accounts.token_account.key(),
        authority: ctx.accounts.authority.key(),
    });

    msg!("Account frozen: {}", ctx.accounts.token_account.key());
    Ok(())
}

#[derive(Accounts)]
pub struct ThawTokenAccount<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin_config.bump,
        constraint = authority.key() == stablecoin_config.authority
            || authority.key() == stablecoin_config.blacklister
            @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        constraint = mint.key() == stablecoin_config.mint @ StablecoinError::InvalidConfig,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn thaw_handler(ctx: Context<ThawTokenAccount>) -> Result<()> {
    let mint_key = ctx.accounts.stablecoin_config.mint;
    let bump = ctx.accounts.stablecoin_config.bump;
    let seeds = &[
        STABLECOIN_SEED,
        mint_key.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    thaw_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            ThawAccount {
                account: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.stablecoin_config.to_account_info(),
            },
            signer_seeds,
        ),
    )?;

    emit!(AccountThawed {
        mint: ctx.accounts.mint.key(),
        account: ctx.accounts.token_account.key(),
        authority: ctx.accounts.authority.key(),
    });

    msg!("Account thawed: {}", ctx.accounts.token_account.key());
    Ok(())
}
