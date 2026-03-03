use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, MintTo, mint_to};

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::TokensMinted;
use crate::state::{StablecoinConfig, MinterConfig};

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin_config.bump,
        constraint = !stablecoin_config.paused @ StablecoinError::Paused,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        mut,
        seeds = [MINTER_SEED, stablecoin_config.key().as_ref(), minter.key().as_ref()],
        bump = minter_config.bump,
        constraint = minter_config.active @ StablecoinError::Unauthorized,
    )]
    pub minter_config: Account<'info, MinterConfig>,

    #[account(
        mut,
        constraint = mint.key() == stablecoin_config.mint @ StablecoinError::InvalidConfig,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn mint_handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, StablecoinError::ZeroAmount);

    let minter_config = &mut ctx.accounts.minter_config;

    // Check quota
    let new_minted = minter_config.minted
        .checked_add(amount)
        .ok_or(StablecoinError::MathOverflow)?;
    require!(new_minted <= minter_config.quota, StablecoinError::QuotaExceeded);

    // Mint tokens using PDA as mint authority
    let stablecoin_key = ctx.accounts.stablecoin_config.mint;
    let bump = ctx.accounts.stablecoin_config.bump;
    let seeds = &[
        STABLECOIN_SEED,
        stablecoin_key.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.stablecoin_config.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // Update state
    minter_config.minted = new_minted;
    ctx.accounts.stablecoin_config.total_minted = ctx.accounts.stablecoin_config
        .total_minted
        .checked_add(amount)
        .ok_or(StablecoinError::MathOverflow)?;

    emit!(TokensMinted {
        mint: ctx.accounts.mint.key(),
        recipient: ctx.accounts.recipient_token_account.key(),
        amount,
        minter: ctx.accounts.minter.key(),
    });

    msg!("Minted {} tokens", amount);
    Ok(())
}
