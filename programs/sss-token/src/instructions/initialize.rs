use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::StablecoinInitialized;
use crate::state::{StablecoinConfig, StablecoinInitConfig};

#[derive(Accounts)]
#[instruction(config: StablecoinInitConfig)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = StablecoinConfig::LEN,
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    /// The Token-2022 mint to be created/initialized externally
    /// Must be initialized with appropriate extensions before calling this
    #[account(
        mut,
        mint::token_program = token_program,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_handler(ctx: Context<Initialize>, config: StablecoinInitConfig) -> Result<()> {
    // Validate inputs
    require!(config.name.len() <= MAX_NAME_LEN, StablecoinError::NameTooLong);
    require!(config.symbol.len() <= MAX_SYMBOL_LEN, StablecoinError::SymbolTooLong);
    require!(config.uri.len() <= MAX_URI_LEN, StablecoinError::UriTooLong);
    require!(config.decimals <= MAX_DECIMALS, StablecoinError::InvalidDecimals);

    // If transfer hook is enabled, program ID must be provided
    if config.enable_transfer_hook {
        require!(
            config.transfer_hook_program.is_some(),
            StablecoinError::InvalidConfig
        );
    }

    let stablecoin = &mut ctx.accounts.stablecoin_config;
    stablecoin.authority = ctx.accounts.authority.key();
    stablecoin.mint = ctx.accounts.mint.key();
    stablecoin.name = config.name.clone();
    stablecoin.symbol = config.symbol.clone();
    stablecoin.uri = config.uri.clone();
    stablecoin.decimals = config.decimals;
    stablecoin.enable_permanent_delegate = config.enable_permanent_delegate;
    stablecoin.enable_transfer_hook = config.enable_transfer_hook;
    stablecoin.default_account_frozen = config.default_account_frozen;
    stablecoin.transfer_hook_program = config.transfer_hook_program.unwrap_or_default();
    stablecoin.pauser = ctx.accounts.authority.key();
    stablecoin.blacklister = ctx.accounts.authority.key();
    stablecoin.seizer = ctx.accounts.authority.key();
    stablecoin.paused = false;
    stablecoin.total_minted = 0;
    stablecoin.total_burned = 0;
    stablecoin.bump = ctx.bumps.stablecoin_config;
    stablecoin._reserved = [0u8; 64];

    let preset = if stablecoin.is_sss2() {
        "SSS-2"
    } else {
        "SSS-1"
    };

    emit!(StablecoinInitialized {
        mint: ctx.accounts.mint.key(),
        authority: ctx.accounts.authority.key(),
        name: config.name,
        symbol: config.symbol,
        decimals: config.decimals,
        preset: preset.to_string(),
        enable_permanent_delegate: config.enable_permanent_delegate,
        enable_transfer_hook: config.enable_transfer_hook,
    });

    msg!("Stablecoin initialized: {} ({})", stablecoin.symbol, preset);
    Ok(())
}
