use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked};

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::{BlacklistAdded, BlacklistRemoved, TokensSeized};
use crate::state::{StablecoinConfig, BlacklistEntry};

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct ManageBlacklist<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
        constraint = stablecoin_config.is_sss2() @ StablecoinError::ComplianceNotEnabled,
        constraint = authority.key() == stablecoin_config.blacklister
            || authority.key() == stablecoin_config.authority
            @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        init_if_needed,
        payer = authority,
        space = BlacklistEntry::LEN,
        seeds = [BLACKLIST_SEED, stablecoin_config.key().as_ref(), address.as_ref()],
        bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    pub system_program: Program<'info, System>,
}

pub fn add_to_blacklist_handler(
    ctx: Context<ManageBlacklist>,
    address: Pubkey,
    reason: String,
) -> Result<()> {
    require!(reason.len() <= MAX_REASON_LEN, StablecoinError::ReasonTooLong);

    let entry = &mut ctx.accounts.blacklist_entry;
    entry.stablecoin = ctx.accounts.stablecoin_config.key();
    entry.address = address;
    entry.reason = reason.clone();
    entry.created_at = Clock::get()?.unix_timestamp;
    entry.blacklisted_by = ctx.accounts.authority.key();
    entry.bump = ctx.bumps.blacklist_entry;

    emit!(BlacklistAdded {
        mint: ctx.accounts.stablecoin_config.mint,
        address,
        reason,
        authority: ctx.accounts.authority.key(),
    });

    msg!("Address {} added to blacklist", address);
    Ok(())
}

pub fn remove_from_blacklist_handler(
    ctx: Context<ManageBlacklist>,
    address: Pubkey,
) -> Result<()> {
    let entry = &ctx.accounts.blacklist_entry;
    require!(entry.address == address, StablecoinError::NotBlacklisted);

    // Zero out the entry to mark as removed
    let entry = &mut ctx.accounts.blacklist_entry;
    entry.address = Pubkey::default();
    entry.reason = String::new();
    entry.created_at = 0;

    emit!(BlacklistRemoved {
        mint: ctx.accounts.stablecoin_config.mint,
        address,
        authority: ctx.accounts.authority.key(),
    });

    msg!("Address {} removed from blacklist", address);
    Ok(())
}

#[derive(Accounts)]
pub struct SeizeTokens<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin_config.bump,
        constraint = stablecoin_config.is_sss2() @ StablecoinError::ComplianceNotEnabled,
        constraint = stablecoin_config.enable_permanent_delegate @ StablecoinError::PermanentDelegateNotEnabled,
        constraint = authority.key() == stablecoin_config.seizer
            || authority.key() == stablecoin_config.authority
            @ StablecoinError::Unauthorized,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        constraint = mint.key() == stablecoin_config.mint @ StablecoinError::InvalidConfig,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// The token account to seize from (must be frozen/blacklisted)
    #[account(
        mut,
        token::mint = mint,
    )]
    pub from_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Treasury token account to receive seized tokens
    #[account(
        mut,
        token::mint = mint,
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn seize_handler(ctx: Context<SeizeTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, StablecoinError::ZeroAmount);

    // Transfer using permanent delegate authority (the stablecoin config PDA)
    let mint_key = ctx.accounts.stablecoin_config.mint;
    let bump = ctx.accounts.stablecoin_config.bump;
    let seeds = &[
        STABLECOIN_SEED,
        mint_key.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.from_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.stablecoin_config.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    emit!(TokensSeized {
        mint: ctx.accounts.mint.key(),
        from: ctx.accounts.from_token_account.key(),
        to: ctx.accounts.treasury_token_account.key(),
        amount,
        authority: ctx.accounts.authority.key(),
    });

    msg!("Seized {} tokens", amount);
    Ok(())
}
