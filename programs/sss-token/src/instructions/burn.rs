use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, Burn, burn};

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::TokensBurned;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub burner: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin_config.bump,
        constraint = !stablecoin_config.paused @ StablecoinError::Paused,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        mut,
        constraint = mint.key() == stablecoin_config.mint @ StablecoinError::InvalidConfig,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = burner,
    )]
    pub burner_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn burn_handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, StablecoinError::ZeroAmount);

    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.burner_token_account.to_account_info(),
                authority: ctx.accounts.burner.to_account_info(),
            },
        ),
        amount,
    )?;

    ctx.accounts.stablecoin_config.total_burned = ctx.accounts.stablecoin_config
        .total_burned
        .checked_add(amount)
        .ok_or(StablecoinError::MathOverflow)?;

    emit!(TokensBurned {
        mint: ctx.accounts.mint.key(),
        amount,
        burner: ctx.accounts.burner.key(),
    });

    msg!("Burned {} tokens", amount);
    Ok(())
}
