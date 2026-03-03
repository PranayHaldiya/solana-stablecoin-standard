use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::{StablecoinInitConfig, RoleType};

declare_id!("3TBnziiRfJEusEa21mg6UyEETUqPhr8EmjfoWPGzgCxk");

#[program]
pub mod sss_token {
    use super::*;

    // ============ Core Instructions (All Presets) ============

    /// Initialize a new stablecoin with configurable extensions
    pub fn initialize(
        ctx: Context<Initialize>,
        config: StablecoinInitConfig,
    ) -> Result<()> {
        instructions::initialize::initialize_handler(ctx, config)
    }

    /// Mint tokens to a recipient (minter role required)
    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        amount: u64,
    ) -> Result<()> {
        instructions::mint::mint_handler(ctx, amount)
    }

    /// Burn tokens from caller's account (burner role required)
    pub fn burn_tokens(
        ctx: Context<BurnTokens>,
        amount: u64,
    ) -> Result<()> {
        instructions::burn::burn_handler(ctx, amount)
    }

    /// Freeze a token account (freeze authority required)
    pub fn freeze_account(
        ctx: Context<FreezeTokenAccount>,
    ) -> Result<()> {
        instructions::freeze::freeze_handler(ctx)
    }

    /// Thaw a frozen token account (freeze authority required)
    pub fn thaw_account(
        ctx: Context<ThawTokenAccount>,
    ) -> Result<()> {
        instructions::freeze::thaw_handler(ctx)
    }

    /// Pause all token operations (pauser role required)
    pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
        instructions::admin::pause_handler(ctx)
    }

    /// Unpause token operations (pauser role required)
    pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
        instructions::admin::unpause_handler(ctx)
    }

    /// Update minter role - add/remove minter with quota
    pub fn update_minter(
        ctx: Context<UpdateMinter>,
        minter: Pubkey,
        quota: u64,
        active: bool,
    ) -> Result<()> {
        instructions::roles::update_minter_handler(ctx, minter, quota, active)
    }

    /// Update roles (blacklister, pauser, seizer) - master authority only
    pub fn update_roles(
        ctx: Context<UpdateRoles>,
        role: RoleType,
        account: Pubkey,
    ) -> Result<()> {
        instructions::roles::update_roles_handler(ctx, role, account)
    }

    /// Transfer master authority to a new account
    pub fn transfer_authority(
        ctx: Context<AdminAction>,
        new_authority: Pubkey,
    ) -> Result<()> {
        instructions::admin::transfer_authority_handler(ctx, new_authority)
    }

    // ============ SSS-2 Compliance Instructions ============

    /// Add an address to the blacklist (blacklister role, SSS-2 only)
    pub fn add_to_blacklist(
        ctx: Context<ManageBlacklist>,
        address: Pubkey,
        reason: String,
    ) -> Result<()> {
        instructions::compliance::add_to_blacklist_handler(ctx, address, reason)
    }

    /// Remove an address from the blacklist (blacklister role, SSS-2 only)
    pub fn remove_from_blacklist(
        ctx: Context<ManageBlacklist>,
        address: Pubkey,
    ) -> Result<()> {
        instructions::compliance::remove_from_blacklist_handler(ctx, address)
    }

    /// Seize tokens from a frozen/blacklisted account via permanent delegate (seizer role, SSS-2 only)
    pub fn seize(
        ctx: Context<SeizeTokens>,
        amount: u64,
    ) -> Result<()> {
        instructions::compliance::seize_handler(ctx, amount)
    }

    // ============ View / Query Instructions ============

    /// Get stablecoin supply info
    pub fn get_supply(ctx: Context<ViewStablecoin>) -> Result<()> {
        instructions::view::get_supply_handler(ctx)
    }

    /// Check if an address is blacklisted
    pub fn check_blacklist(ctx: Context<CheckBlacklist>, address: Pubkey) -> Result<()> {
        instructions::view::check_blacklist_handler(ctx, address)
    }
}
