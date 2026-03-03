use anchor_lang::prelude::*;

use crate::constants::*;

/// Core stablecoin configuration account
#[account]
pub struct StablecoinConfig {
    /// Master authority (can manage all roles)
    pub authority: Pubkey,
    /// Token mint address (Token-2022)
    pub mint: Pubkey,
    /// Token name
    pub name: String,
    /// Token symbol
    pub symbol: String,
    /// Metadata URI
    pub uri: String,
    /// Token decimals
    pub decimals: u8,
    /// Whether permanent delegate is enabled (SSS-2)
    pub enable_permanent_delegate: bool,
    /// Whether transfer hook is enabled (SSS-2)
    pub enable_transfer_hook: bool,
    /// Whether accounts are frozen by default (SSS-2)
    pub default_account_frozen: bool,
    /// Transfer hook program ID (if enabled)
    pub transfer_hook_program: Pubkey,
    /// Pauser role address
    pub pauser: Pubkey,
    /// Blacklister role address (SSS-2)
    pub blacklister: Pubkey,
    /// Seizer role address (SSS-2)
    pub seizer: Pubkey,
    /// Whether operations are paused
    pub paused: bool,
    /// Total supply minted (tracked for convenience)
    pub total_minted: u64,
    /// Total supply burned (tracked for convenience)
    pub total_burned: u64,
    /// PDA bump
    pub bump: u8,
    /// Reserved for future upgrades
    pub _reserved: [u8; 64],
}

impl StablecoinConfig {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // authority
        32 +  // mint
        (4 + MAX_NAME_LEN) +   // name (borsh string)
        (4 + MAX_SYMBOL_LEN) + // symbol
        (4 + MAX_URI_LEN) +    // uri
        1 +   // decimals
        1 +   // enable_permanent_delegate
        1 +   // enable_transfer_hook
        1 +   // default_account_frozen
        32 +  // transfer_hook_program
        32 +  // pauser
        32 +  // blacklister
        32 +  // seizer
        1 +   // paused
        8 +   // total_minted
        8 +   // total_burned
        1 +   // bump
        64;   // _reserved

    pub fn is_sss2(&self) -> bool {
        self.enable_permanent_delegate || self.enable_transfer_hook
    }
}

/// Minter configuration PDA - tracks per-minter quotas
#[account]
pub struct MinterConfig {
    /// The stablecoin config this minter belongs to
    pub stablecoin: Pubkey,
    /// The minter's public key
    pub minter: Pubkey,
    /// Maximum amount this minter can mint
    pub quota: u64,
    /// Amount already minted by this minter
    pub minted: u64,
    /// Whether this minter is active
    pub active: bool,
    /// PDA bump
    pub bump: u8,
}

impl MinterConfig {
    pub const LEN: usize = 8 + // discriminator
        32 + // stablecoin
        32 + // minter
        8 +  // quota
        8 +  // minted
        1 +  // active
        1;   // bump
}

/// Blacklist entry PDA
#[account]
pub struct BlacklistEntry {
    /// The stablecoin config this entry belongs to
    pub stablecoin: Pubkey,
    /// The blacklisted address
    pub address: Pubkey,
    /// Reason for blacklisting
    pub reason: String,
    /// When the address was blacklisted
    pub created_at: i64,
    /// Who blacklisted this address
    pub blacklisted_by: Pubkey,
    /// PDA bump
    pub bump: u8,
}

impl BlacklistEntry {
    pub const LEN: usize = 8 + // discriminator
        32 + // stablecoin
        32 + // address
        (4 + MAX_REASON_LEN) + // reason
        8 +  // created_at
        32 + // blacklisted_by
        1;   // bump
}

/// Initialization config passed as instruction argument
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StablecoinInitConfig {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    /// SSS-2 compliance settings
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    /// Transfer hook program ID (required if enable_transfer_hook = true)
    pub transfer_hook_program: Option<Pubkey>,
}

/// Role types for update_roles instruction
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum RoleType {
    Pauser,
    Blacklister,
    Seizer,
}
